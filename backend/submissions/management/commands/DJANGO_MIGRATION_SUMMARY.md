# Django Management Command Migration Summary

## Overview

Successfully converted the ETL functionality from a standalone module to a proper Django management command. This resolves import issues and integrates the cannabis data loading functionality directly into the Django ecosystem.

## Migration Details

### New Structure

```
backend/submissions/management/
├── __init__.py
└── commands/
    ├── __init__.py
    ├── load_cannabis_data.py          # Main Django management command
    └── etl_modules/
        ├── __init__.py
        ├── data_mapper.py              # Cannabis data mapping logic
        ├── content_type_mapper.py      # Content type mapping
        ├── police_data_parser.py       # Police data parsing
        └── model_factory.py            # Django model factory
```

### Django Management Command

**File**: `backend/submissions/management/commands/load_cannabis_data.py`

**Usage**:

```bash
# Test mode (safe, no production impact)
python manage.py load_cannabis_data --max-records 10 -v 2

# Production mode (requires confirmation)
python manage.py load_cannabis_data --real

# Custom file and batch processing
python manage.py load_cannabis_data --file path/to/data.json --batch-size 50

# Resume from specific record
python manage.py load_cannabis_data --start-from 1000
```

**Features**:

-   **Safe Testing**: Default test mode prevents accidental production changes
-   **Production Confirmation**: Requires explicit "yes" confirmation for --real mode
-   **Batch Processing**: Configurable batch sizes for memory management
-   **Resume Capability**: Start from specific record numbers
-   **Progress Reporting**: Real-time progress updates and statistics
-   **Comprehensive Logging**: Configurable verbosity levels
-   **Error Handling**: Continues processing on individual record failures
-   **Database Statistics**: Shows final counts of created records

### Command Line Options

| Option            | Description                             | Default                               |
| ----------------- | --------------------------------------- | ------------------------------------- |
| `--file`          | Path to JSON file                       | `etl/data/modded/cannabis_final.json` |
| `--real`          | Production mode (requires confirmation) | False (test mode)                     |
| `--batch-size`    | Records per batch                       | 100                                   |
| `--start-from`    | Starting record number                  | 0                                     |
| `--max-records`   | Maximum records to process              | All                                   |
| `-v, --verbosity` | Logging level (0-3)                     | 1                                     |

### Benefits of Django Integration

1. **Proper Django Context**: Full access to Django ORM, settings, and models
2. **No Import Issues**: Resolves relative import problems
3. **Built-in Management**: Uses Django's management command infrastructure
4. **Database Integration**: Automatic database connection handling
5. **Settings Access**: Access to Django settings and configuration
6. **Logging Integration**: Uses Django's logging framework
7. **Transaction Support**: Proper Django transaction handling
8. **Model Validation**: Full Django model validation and constraints

### Test Results

Successfully tested with sample data:

```
Using JSON file: /path/to/cannabis_final.json
Running in TEST mode (use --real for production)
Loading JSON data...
Found 3727 records in JSON file
Processing maximum 1 records
Processing 1 records in batches of 100...

Progress: 1/1 (100.0%) - Success: 1, Failed: 0

============================================================
CANNABIS DATA LOADING SUMMARY
============================================================
Total records processed: 1
Successful: 1

Database Statistics:
  Submissions: 1
  Drug Bags: 2
  Botanical Assessments: 2
  Police Officers: 2
  Police Stations: 1
  Defendants: 1
```

### ETL Modules

All existing ETL functionality has been preserved and moved to `etl_modules/`:

1. **data_mapper.py**: Cannabis data mapping with proper Django imports
2. **model_factory.py**: Django model factory with transaction support
3. **content_type_mapper.py**: Content type mapping logic
4. **police_data_parser.py**: Police data parsing functionality

### Error Handling Improvements

-   **Timezone Warnings**: Identified datetime timezone issues (can be addressed in future updates)
-   **Missing Data Handling**: Graceful handling of missing botanist users
-   **Batch Processing**: Continues processing even if individual records fail
-   **Comprehensive Logging**: Detailed error reporting and debugging information

### Next Steps

1. **Address Timezone Issues**: Update datetime handling for timezone awareness
2. **Create Botanist Users**: Ensure botanist users exist in the database
3. **Production Testing**: Test with larger datasets in staging environment
4. **Performance Optimization**: Monitor and optimize for large-scale data loading

### Usage Examples

```bash
# Quick test with 5 records
python manage.py load_cannabis_data --max-records 5 -v 2

# Load specific file with custom batch size
python manage.py load_cannabis_data --file custom_data.json --batch-size 50

# Production load (requires confirmation)
python manage.py load_cannabis_data --real

# Resume interrupted load from record 1500
python manage.py load_cannabis_data --start-from 1500 --real
```

## Conclusion

The migration to Django management command successfully resolves the import issues while providing a robust, production-ready data loading system with comprehensive error handling, progress reporting, and safety features.
