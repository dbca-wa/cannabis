"""
Database Manager for Cannabis Data Loader

This module provides database management capabilities including:
- Disposable PostgreSQL database creation for testing
- Production database connection validation
- Migration management
- Automatic cleanup
"""

import os
import tempfile
import subprocess
import time
import logging
from typing import Optional, Dict, Any, List
from contextlib import contextmanager

from django.conf import settings
from django.core.management import call_command
from django.db import connections, connection, transaction
from django.db.utils import OperationalError, IntegrityError
from django.test.utils import setup_test_environment, teardown_test_environment

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections and operations for the cannabis data loader"""

    def __init__(self):
        self.test_db_name = None
        self.original_db_settings = None

    def create_disposable_database(self) -> Dict[str, Any]:
        """
        Create a temporary PostgreSQL database for testing

        Returns:
            Dict containing database connection information
        """
        logger.info("Creating disposable PostgreSQL database for testing...")

        # Generate unique database name
        import uuid

        self.test_db_name = f"test_cannabis_loader_{uuid.uuid4().hex[:8]}"

        # Store original database settings
        self.original_db_settings = settings.DATABASES["default"].copy()

        try:
            # Create test database using Django's test database creation
            from django.test.utils import setup_test_environment
            from django.db import connection

            setup_test_environment()

            # Create test database
            test_db_settings = self.original_db_settings.copy()
            test_db_settings["NAME"] = self.test_db_name

            # Update Django settings to use test database
            settings.DATABASES["default"] = test_db_settings

            # Force Django to use new connection
            connections.close_all()

            # Create the database
            self._create_test_database()

            logger.info(f"Created disposable database: {self.test_db_name}")

            return {
                "name": self.test_db_name,
                "settings": test_db_settings,
                "original_settings": self.original_db_settings,
            }

        except Exception as e:
            logger.error(f"Failed to create disposable database: {e}")
            # Restore original settings on failure
            if self.original_db_settings:
                settings.DATABASES["default"] = self.original_db_settings
                connections.close_all()
            raise

    def _create_test_database(self):
        """Create the test database using Django's database creation"""
        from django.db import connection

        # Get database creation class
        creation_class = connection.creation.__class__
        creation = creation_class(connection)

        # Create test database
        creation.create_test_db(
            verbosity=1, autoclobber=True, serialize=False, keepdb=False
        )

    def run_migrations(self) -> bool:
        """
        Run Django migrations on the current database

        Returns:
            bool: True if migrations successful, False otherwise
        """
        try:
            logger.info("Running Django migrations...")

            # Run migrations
            call_command("migrate", verbosity=1, interactive=False)

            logger.info("Migrations completed successfully")
            return True

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False

    def validate_schema(self) -> bool:
        """
        Validate that required database tables exist

        Returns:
            bool: True if schema is valid, False otherwise
        """
        try:
            from django.db import connection

            # Check if required tables exist
            required_tables = [
                "submissions_submission",
                "submissions_drugbag",
                "submissions_botanicalassessment",
                "submissions_defendant",
                "police_policeofficer",
                "police_policestation",
            ]

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """
                )
                existing_tables = [row[0] for row in cursor.fetchall()]

            missing_tables = [
                table for table in required_tables if table not in existing_tables
            ]

            if missing_tables:
                logger.error(f"Missing required tables: {missing_tables}")
                return False

            logger.info("Database schema validation successful")
            return True

        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            return False

    def cleanup_disposable_database(self):
        """Clean up the disposable test database"""
        if not self.test_db_name or not self.original_db_settings:
            logger.warning("No disposable database to clean up")
            return

        try:
            logger.info(f"Cleaning up disposable database: {self.test_db_name}")

            # Close all connections
            connections.close_all()

            # Restore original database settings
            settings.DATABASES["default"] = self.original_db_settings

            # Drop test database
            self._drop_test_database()

            # Clean up test environment
            teardown_test_environment()

            logger.info("Disposable database cleanup completed")

        except Exception as e:
            logger.error(f"Failed to cleanup disposable database: {e}")
        finally:
            # Reset instance variables
            self.test_db_name = None
            self.original_db_settings = None

    def _drop_test_database(self):
        """Drop the test database"""
        try:
            from django.db import connection

            # Get database creation class
            creation_class = connection.creation.__class__
            creation = creation_class(connection)

            # Drop test database
            creation.destroy_test_db(self.test_db_name, verbosity=1)

        except Exception as e:
            logger.warning(f"Could not drop test database {self.test_db_name}: {e}")

    def validate_production_connection(self) -> bool:
        """
        Validate production database connectivity and permissions

        Returns:
            bool: True if connection is valid, False otherwise
        """
        try:
            from django.db import connection

            logger.info("Validating production database connection...")

            # Test basic connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()

            if not result or result[0] != 1:
                logger.error("Basic database connection test failed")
                return False

            # Test database permissions
            if not self._validate_database_permissions():
                return False

            # Test database version compatibility
            if not self._validate_database_version():
                return False

            logger.info("Production database connection validated successfully")
            return True

        except Exception as e:
            logger.error(f"Production database connection validation failed: {e}")
            return False

    def _validate_database_permissions(self) -> bool:
        """Validate that we have necessary database permissions"""
        try:
            from django.db import connection

            # Test INSERT permission on a key table
            with connection.cursor() as cursor:
                # Check if we can perform basic operations
                cursor.execute(
                    """
                    SELECT has_table_privilege(current_user, 'submissions_submission', 'INSERT'),
                           has_table_privilege(current_user, 'submissions_submission', 'UPDATE'),
                           has_table_privilege(current_user, 'submissions_submission', 'SELECT')
                """
                )
                permissions = cursor.fetchone()

                if not all(permissions):
                    logger.error(
                        "Insufficient database permissions for submissions table"
                    )
                    return False

            logger.debug("Database permissions validated")
            return True

        except Exception as e:
            logger.error(f"Permission validation failed: {e}")
            return False

    def _validate_database_version(self) -> bool:
        """Validate PostgreSQL version compatibility"""
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("SELECT version()")
                version_info = cursor.fetchone()[0]

                # Extract major version number
                import re

                version_match = re.search(r"PostgreSQL (\d+)", version_info)
                if version_match:
                    major_version = int(version_match.group(1))
                    if major_version < 10:
                        logger.error(
                            f"PostgreSQL version {major_version} is too old (minimum: 10)"
                        )
                        return False

                    logger.debug(f"PostgreSQL version validated: {major_version}")
                    return True
                else:
                    logger.warning("Could not determine PostgreSQL version")
                    return True  # Continue anyway

        except Exception as e:
            logger.warning(f"Version validation failed: {e}")
            return True  # Continue anyway

    @contextmanager
    def production_transaction_context(
        self, retry_on_failure: bool = True, max_retries: int = 3
    ):
        """
        Context manager for production database operations with rollback capability and retry logic

        Usage:
            with db_manager.production_transaction_context():
                # Perform database operations
                # Automatic rollback on exception
                pass
        """
        retry_count = 0

        while retry_count <= max_retries:
            try:
                with transaction.atomic():
                    logger.info(
                        f"Starting production database transaction (attempt {retry_count + 1})"
                    )
                    yield
                    logger.info(
                        "Production database transaction completed successfully"
                    )
                    return  # Success - exit retry loop

            except OperationalError as e:
                # Handle connection-related errors with retry
                retry_count += 1
                error_msg = str(e).lower()

                if (
                    retry_on_failure
                    and retry_count <= max_retries
                    and any(
                        keyword in error_msg
                        for keyword in [
                            "connection",
                            "timeout",
                            "server",
                            "network",
                            "temporary",
                        ]
                    )
                ):
                    wait_time = 2**retry_count  # Exponential backoff
                    logger.warning(
                        f"Database connection error (attempt {retry_count}), retrying in {wait_time}s: {e}"
                    )
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(
                        f"Production database transaction failed after {retry_count} attempts: {e}"
                    )
                    raise

            except IntegrityError as e:
                # Don't retry integrity errors - they're data issues
                logger.error(f"Production database integrity error, rolling back: {e}")
                raise

            except Exception as e:
                # Don't retry other exceptions
                logger.error(
                    f"Production database transaction failed, rolling back: {e}"
                )
                raise

    def create_savepoint(self) -> str:
        """
        Create a database savepoint for partial rollback

        Returns:
            str: Savepoint identifier
        """
        try:
            savepoint_id = transaction.savepoint()
            logger.debug(f"Created savepoint: {savepoint_id}")
            return savepoint_id

        except Exception as e:
            logger.error(f"Failed to create savepoint: {e}")
            raise

    def rollback_to_savepoint(self, savepoint_id: str):
        """
        Rollback to a specific savepoint

        Args:
            savepoint_id: The savepoint identifier to rollback to
        """
        try:
            transaction.savepoint_rollback(savepoint_id)
            logger.info(f"Rolled back to savepoint: {savepoint_id}")

        except Exception as e:
            logger.error(f"Failed to rollback to savepoint {savepoint_id}: {e}")
            raise

    def release_savepoint(self, savepoint_id: str):
        """
        Release a savepoint (commit the changes)

        Args:
            savepoint_id: The savepoint identifier to release
        """
        try:
            transaction.savepoint_commit(savepoint_id)
            logger.debug(f"Released savepoint: {savepoint_id}")

        except Exception as e:
            logger.error(f"Failed to release savepoint {savepoint_id}: {e}")
            raise

    @contextmanager
    def disposable_database_context(self):
        """
        Context manager for disposable database operations

        Usage:
            with db_manager.disposable_database_context() as db_info:
                # Perform operations with disposable database
                pass
        """
        db_info = None
        try:
            # Create disposable database
            db_info = self.create_disposable_database()

            # Run migrations
            if not self.run_migrations():
                raise Exception("Failed to run migrations on disposable database")

            # Validate schema
            if not self.validate_schema():
                raise Exception("Schema validation failed on disposable database")

            yield db_info

        finally:
            # Always cleanup, even if an exception occurred
            self.cleanup_disposable_database()

    def test_connection_recovery(self, max_retries: int = 3) -> bool:
        """
        Test database connection with recovery attempts

        Args:
            max_retries: Maximum number of connection attempts

        Returns:
            bool: True if connection successful, False otherwise
        """
        retry_count = 0

        while retry_count <= max_retries:
            try:
                from django.db import connection

                # Force new connection
                connection.close()

                # Test connection
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    result = cursor.fetchone()

                if result and result[0] == 1:
                    logger.info(
                        f"Database connection successful (attempt {retry_count + 1})"
                    )
                    return True

            except OperationalError as e:
                retry_count += 1
                error_msg = str(e).lower()

                if retry_count <= max_retries and any(
                    keyword in error_msg
                    for keyword in ["connection", "timeout", "server", "network"]
                ):
                    wait_time = 2**retry_count
                    logger.warning(
                        f"Connection attempt {retry_count} failed, retrying in {wait_time}s: {e}"
                    )
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Connection failed after {retry_count} attempts: {e}")
                    return False

            except Exception as e:
                logger.error(f"Unexpected connection error: {e}")
                return False

        return False

    def recover_from_connection_loss(self) -> bool:
        """
        Attempt to recover from database connection loss

        Returns:
            bool: True if recovery successful, False otherwise
        """
        try:
            logger.info("Attempting to recover from database connection loss...")

            # Close all existing connections
            connections.close_all()

            # Wait a moment for connections to close
            time.sleep(1)

            # Test connection recovery
            if self.test_connection_recovery():
                logger.info("Database connection recovery successful")
                return True
            else:
                logger.error("Database connection recovery failed")
                return False

        except Exception as e:
            logger.error(f"Error during connection recovery: {e}")
            return False

    def handle_database_deadlock(
        self, operation_name: str, max_retries: int = 3
    ) -> bool:
        """
        Handle database deadlock situations with retry logic

        Args:
            operation_name: Name of the operation that encountered deadlock
            max_retries: Maximum number of retry attempts

        Returns:
            bool: True if operation should be retried, False otherwise
        """
        import random

        retry_count = 0

        while retry_count < max_retries:
            try:
                # Random delay to avoid repeated deadlocks
                delay = random.uniform(0.1, 1.0) * (retry_count + 1)
                time.sleep(delay)

                logger.info(
                    f"Retrying {operation_name} after deadlock (attempt {retry_count + 1})"
                )
                return True

            except Exception as e:
                retry_count += 1
                logger.warning(
                    f"Deadlock retry {retry_count} failed for {operation_name}: {e}"
                )

        logger.error(
            f"Failed to resolve deadlock for {operation_name} after {max_retries} attempts"
        )
        return False

    def create_connection_pool_context(self, pool_size: int = 5):
        """
        Create a context manager for connection pooling (simplified implementation)

        Args:
            pool_size: Maximum number of connections in pool
        """

        @contextmanager
        def connection_pool():
            original_max_conns = getattr(
                settings.DATABASES["default"], "CONN_MAX_AGE", 0
            )

            try:
                # Enable connection pooling
                settings.DATABASES["default"]["CONN_MAX_AGE"] = 600  # 10 minutes
                logger.info(f"Enabled connection pooling with max age 600s")
                yield

            finally:
                # Restore original settings
                settings.DATABASES["default"]["CONN_MAX_AGE"] = original_max_conns
                connections.close_all()
                logger.info("Disabled connection pooling and closed connections")

        return connection_pool()

    def validate_transaction_isolation(self) -> bool:
        """
        Validate database transaction isolation level

        Returns:
            bool: True if isolation level is appropriate, False otherwise
        """
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("SHOW transaction_isolation")
                isolation_level = cursor.fetchone()[0]

                # Check if isolation level is appropriate for our operations
                acceptable_levels = ["read committed", "repeatable read"]

                if isolation_level.lower() in acceptable_levels:
                    logger.info(
                        f"Transaction isolation level is acceptable: {isolation_level}"
                    )
                    return True
                else:
                    logger.warning(
                        f"Transaction isolation level may cause issues: {isolation_level}"
                    )
                    return False

        except Exception as e:
            logger.warning(f"Could not validate transaction isolation: {e}")
            return True  # Continue anyway

    def create_batch_transaction_context(self, batch_size: int = 100):
        """
        Create a context manager for batch transactions with savepoints

        Args:
            batch_size: Number of operations per batch
        """

        @contextmanager
        def batch_transaction():
            savepoints = []

            try:
                with transaction.atomic():
                    logger.info(
                        f"Starting batch transaction context (batch_size: {batch_size})"
                    )

                    # Provide savepoint management
                    def create_batch_savepoint():
                        sp_id = transaction.savepoint()
                        savepoints.append(sp_id)
                        return sp_id

                    def rollback_batch_savepoint(sp_id):
                        if sp_id in savepoints:
                            transaction.savepoint_rollback(sp_id)
                            savepoints.remove(sp_id)

                    def commit_batch_savepoint(sp_id):
                        if sp_id in savepoints:
                            transaction.savepoint_commit(sp_id)
                            savepoints.remove(sp_id)

                    yield {
                        "create_savepoint": create_batch_savepoint,
                        "rollback_savepoint": rollback_batch_savepoint,
                        "commit_savepoint": commit_batch_savepoint,
                    }

                    logger.info("Batch transaction completed successfully")

            except Exception as e:
                logger.error(f"Batch transaction failed, rolling back: {e}")
                # Rollback any remaining savepoints
                for sp_id in savepoints:
                    try:
                        transaction.savepoint_rollback(sp_id)
                    except Exception:
                        pass
                raise

        return batch_transaction()


class TestDatabaseConnection:
    """Represents a connection to a disposable test database"""

    def __init__(self, db_info: Dict[str, Any]):
        self.name = db_info["name"]
        self.settings = db_info["settings"]
        self.original_settings = db_info["original_settings"]

    def __str__(self):
        return f"TestDatabase({self.name})"


class ProductionDatabaseConnection:
    """Represents a connection to the production database"""

    def __init__(self):
        self.settings = settings.DATABASES["default"]

    def __str__(self):
        return f"ProductionDatabase({self.settings.get('NAME', 'unknown')})"
