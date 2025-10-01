"""
Django management command for interactive ETL interface.

This command provides an interactive menu system for running Extract, Transform,
and Load operations on cannabis data. It allows running complete pipelines or
individual components for testing and debugging.

Usage:
    python3 manage.py etl_interface
    python3 manage.py etl_interface --help
"""

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
import sys
import os

# Add the backend directory to Python path for ETL imports
backend_path = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    from etl.interface import MenuSystem
    from etl.interface.command_runner import CommandRunner
except ImportError as e:
    raise CommandError(f"Failed to import ETL interface components: {e}")


class Command(BaseCommand):
    """
    Interactive ETL interface for cannabis data processing.

    This command provides a menu-driven interface for:
    - Running complete ETL pipelines
    - Testing individual transformation domains
    - Loading specific entity types
    - Debugging ETL operations
    """

    help = (
        "Interactive ETL interface for cannabis data processing. "
        "Provides menu-driven access to Extract, Transform, and Load operations."
    )

    def add_arguments(self, parser):
        """Add command-line arguments."""

        parser.add_argument(
            "--raw-data-file",
            type=str,
            default="etl/data/raw/Cannabis2000.csv",
            help="Path to the raw cannabis data file (default: etl/data/raw/Cannabis2000.csv)",
        )

        parser.add_argument(
            "--clean-data-file",
            type=str,
            default="etl/data/final/cannabis_clean.json",
            help="Path to the cleaned cannabis data file for loading (default: etl/data/final/cannabis_clean.json)",
        )

        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Run in dry-run mode (show what would be done without making changes)",
        )

        parser.add_argument(
            "--verbose", action="store_true", help="Enable verbose output for debugging"
        )

    def handle(self, *args, **options):
        """Main command handler."""
        try:
            # Display welcome message
            self.stdout.write(
                self.style.SUCCESS(
                    "\n" + "=" * 50 + "\n"
                    "  Cannabis ETL Interface\n"
                    "  Interactive Data Processing System\n"
                    "=" * 50 + "\n"
                )
            )

            # Initialize components
            menu_system = MenuSystem()
            command_runner = CommandRunner(
                raw_data_file=options["raw_data_file"],
                clean_data_file=options["clean_data_file"],
                dry_run=options["dry_run"],
                verbose=options["verbose"],
                stdout=self.stdout,
                stderr=self.stderr,
                style=self.style,
            )

            # Start the interactive menu loop
            self._run_interactive_loop(menu_system, command_runner)

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\n\nOperation cancelled by user."))
            sys.exit(0)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"\nUnexpected error: {e}"))
            if options["verbose"]:
                import traceback

                self.stderr.write(traceback.format_exc())
            sys.exit(1)

    def _run_interactive_loop(self, menu_system, command_runner):
        """Run the main interactive menu loop."""
        try:
            while True:
                # Show main menu and get user choice
                choice = menu_system.show_main_menu()

                if choice == "4":  # Exit
                    self.stdout.write(
                        self.style.SUCCESS("\nThank you for using the ETL interface!")
                    )
                    break
                elif choice == "1":  # Extract (disabled)
                    self.stdout.write(
                        self.style.WARNING(
                            "\nExtract phase is disabled - data already exists.\n"
                            f"Using raw data file: {command_runner.config.raw_data_file}\n"
                            f"Transform output will be: {command_runner.config.clean_data_file}\n"
                        )
                    )
                    input("Press Enter to continue...")
                elif choice == "2":  # Transform
                    self._handle_transform_menu(menu_system, command_runner)
                elif choice == "3":  # Load
                    self._handle_load_menu(menu_system, command_runner)
                else:
                    self.stdout.write(
                        self.style.ERROR("Invalid selection. Please try again.")
                    )

        except KeyboardInterrupt:
            raise  # Re-raise to be handled by main handler

    def _handle_transform_menu(self, menu_system, command_runner):
        """Handle transform menu navigation and execution."""
        while True:
            choice = menu_system.show_transform_menu()

            if choice == "15":  # Back to main menu
                break
            elif choice == "1":  # Run all transformations
                result = command_runner.run_all_transforms()
                menu_system.display_results(result)
            else:
                # Individual domain transformation
                domain_name = menu_system.get_domain_name_from_choice(choice)
                if domain_name:
                    result = command_runner.run_single_transform(domain_name)
                    menu_system.display_results(result)
                else:
                    self.stdout.write(
                        self.style.ERROR("Invalid selection. Please try again.")
                    )

    def _handle_load_menu(self, menu_system, command_runner):
        """Handle load menu navigation and execution."""
        while True:
            choice = menu_system.show_load_menu()

            if choice == "7":  # Back to main menu
                break
            elif choice == "1":  # Run all loads
                result = command_runner.run_all_loads()
                menu_system.display_results(result)
            else:
                # Individual entity loading
                entity_type = menu_system.get_entity_type_from_choice(choice)
                if entity_type:
                    result = command_runner.run_single_load(entity_type)
                    menu_system.display_results(result)
                else:
                    self.stdout.write(
                        self.style.ERROR("Invalid selection. Please try again.")
                    )
