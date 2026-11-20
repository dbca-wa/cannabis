"""Run legacy import tasks from the app, in the background.

A maintainer starts a task from the Settings page; it runs in a thread of the
web process, records its progress on a ``LegacyImportRun`` and needs nothing on
disk: the inputs come from the uploaded bundle and the code ships in the image.

One task runs at a time. The import itself runs in one database transaction, so
a task cut short (for example by a restart) leaves the data as it was; a run
still marked running after ``STALE_AFTER`` is treated as interrupted.
"""

import logging
import threading
import traceback
from datetime import timedelta

from django.conf import settings
from django.db import close_old_connections, connection, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from cases.models import LegacyImportBundle, LegacyImportRun
from common.logging import describe_user

logger = logging.getLogger(__name__)

STALE_AFTER = timedelta(minutes=30)
Action = LegacyImportRun.Action
Status = LegacyImportRun.Status


def latest_bundle():
    return LegacyImportBundle.objects.order_by("-uploaded_at").first()


@transaction.atomic
def start_run(action, user):
    """Record a new run and start it once the record is committed."""
    if action not in Action.values:
        raise ValidationError({"action": f"Unknown task {action!r}."})
    # Lock the runs table's newest row so two maintainers cannot both start.
    running = LegacyImportRun.objects.select_for_update().filter(status=Status.RUNNING)
    for run in running:
        if timezone.now() - run.started_at > STALE_AFTER:
            run.status = Status.FAILED
            run.error = "Interrupted: the task stopped before it finished."
            run.finished_at = timezone.now()
            run.save(update_fields=["status", "error", "finished_at"])
        else:
            raise ValidationError(
                f"{run.get_action_display()} is already running; wait for it to finish."
            )
    bundle = latest_bundle()
    if action != Action.UNDO and bundle is None:
        raise ValidationError("Upload the legacy import bundle first.")
    run = LegacyImportRun.objects.create(
        action=action,
        started_by=user,
        bundle_sha256=bundle.sha256 if bundle and action != Action.UNDO else "",
    )
    settings.LOGGER.info(
        f"{describe_user(user)} started legacy import task "
        f"{run.get_action_display().lower()} ({run.pk})"
    )
    transaction.on_commit(lambda: launch(run.pk))
    return run


def launch(run_id):
    """Run the task in a background thread (tests replace this to run inline)."""
    threading.Thread(target=_in_thread, args=(run_id,), daemon=True).start()


def _in_thread(run_id):
    # A thread gets its own database connection; tidy it either side.
    close_old_connections()
    try:
        execute(run_id)
    finally:
        connection.close()


class RunLog:
    def __init__(self, run):
        self.run = run
        self.lines = []

    def __call__(self, message):
        stamp = timezone.localtime().strftime("%H:%M:%S")
        self.lines.append(f"{stamp} {message}")
        LegacyImportRun.objects.filter(pk=self.run.pk).update(log="\n".join(self.lines))


def execute(run_id):
    """Carry out one run and record the outcome. Never raises."""
    run = LegacyImportRun.objects.get(pk=run_id)
    log = RunLog(run)
    try:
        status, summary, report = TASKS[run.action](run, log)
        run.status, run.summary, run.report = status, summary, report
    except Exception as error:  # noqa: BLE001 - recorded on the run
        run.status = Status.FAILED
        run.error = f"{type(error).__name__}: {error}"
        log(f"Failed: {run.error}")
        logger.error("Legacy import run %s failed\n%s", run.pk, traceback.format_exc())
    run.finished_at = timezone.now()
    run.log = "\n".join(log.lines)
    run.save()
    settings.LOGGER.info(
        f"Legacy import task {run.get_action_display().lower()} ({run.pk}) "
        f"finished: {run.get_status_display().lower()}"
    )


# ---------------------------------------------------------------- tasks


def _bundle_for(run, log):
    from etl.bundle import read_bundle

    bundle = latest_bundle()
    if bundle is None or bundle.sha256 != run.bundle_sha256:
        raise ValidationError("The bundle changed after the task was started.")
    log(f"Reading bundle {bundle.filename}")
    return read_bundle(bytes(bundle.content))


def _transform(bundle, log):
    from etl.run_transform import transform_table

    log(f"Transforming {len(bundle.rows)} source rows")
    records, report, _review = transform_table(bundle.rows, rules=bundle.rules)
    failures = sum(len(v) for v in report["domain_failures"].values())
    if failures:
        raise ValidationError(f"The transform reported {failures} error(s).")
    log(f"Transformed into {report['records']} certificates and {report['bags']} bags")
    return records, report


def _load(run, log, dry_run):
    from .importer import LegacyImporter

    bundle = _bundle_for(run, log)
    records, transform_report = _transform(bundle, log)
    log("Loading (dry run, nothing is saved)" if dry_run else "Loading")
    report = LegacyImporter(dry_run=dry_run).run(records)
    result = report.to_dict()
    log(
        f"Cases {report.counts['cases']}, forms {report.counts['forms']}, bags "
        f"{report.counts['bags']}, already imported {report.counts['cases already imported']}, "
        f"failed {len(report.failed_cases)}, conflicts {len(report.conflicts)}"
    )
    summary = {
        "counts": result["counts"],
        "failed_cases": len(report.failed_cases),
        "conflicts": len(report.conflicts),
        "certificates_to_check": len(report.unsplit_certificates),
        "certificates_without_result": len(report.unassessed_certificates),
        "transform": {
            k: transform_report[k] for k in ("records", "bags", "result_basis")
        },
    }
    problems = report.failed_cases or report.conflicts
    if not dry_run:
        reconcile = _reconcile(bundle, log)
        summary["reconcile"] = reconcile["summary"]
        result["reconcile"] = reconcile["report"]
        problems = problems or reconcile["summary"]["unexplained"]
    return (Status.PROBLEMS if problems else Status.SUCCEEDED), summary, result


def _reconcile(bundle, log):
    from etl.verify.oracle import build

    from .reconcile import Reconciler

    log("Working out the expected values from the source table")
    expected = build(bundle.rows, bundle.csv_rows)
    log("Checking the database against them")
    result = Reconciler(expected, bundle.exceptions, bundle.rows).run()
    summary = {
        "checks": sum(result["checked"].values()),
        "unexplained": len(result["unexplained"]),
        "explained": result["explained"],
        "unexplained_by_check": result["unexplained_by_check"],
    }
    log(
        f"{summary['checks']} checks; {summary['unexplained']} unexplained difference(s)"
    )
    return {"summary": summary, "report": result}


def _dry_run(run, log):
    return _load(run, log, dry_run=True)


def _import(run, log):
    return _load(run, log, dry_run=False)


def _reconcile_only(run, log):
    result = _reconcile(_bundle_for(run, log), log)
    status = Status.PROBLEMS if result["summary"]["unexplained"] else Status.SUCCEEDED
    return status, {"reconcile": result["summary"]}, {"reconcile": result["report"]}


def _undo(run, log):
    from .rollback import rollback_import

    log("Removing everything the legacy import created")
    counts = rollback_import()
    log(
        ", ".join(f"{label} {value}" for label, value in counts.items())
        or "Nothing to remove"
    )
    return Status.SUCCEEDED, {"removed": dict(counts)}, {}


TASKS = {
    Action.DRY_RUN: _dry_run,
    Action.IMPORT: _import,
    Action.RECONCILE: _reconcile_only,
    Action.UNDO: _undo,
}
