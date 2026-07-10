<div align="center">
  <img src="frontend/public/cannabis.svg" alt="C" width="350" height="350"/>
  <div>👮 → 📞 → 👩‍🔬 → 📅 → 🔬 → 💻 → 📄 → ✅ → 🏛️</div>

  <br/><br/>

  [![Deploy](https://github.com/dbca-wa/cannabis/actions/workflows/deploy-prod.yml/badge.svg)](https://github.com/dbca-wa/cannabis/actions/workflows/deploy-prod.yml)
  [![Staging](https://github.com/dbca-wa/cannabis/actions/workflows/deploy-staging.yml/badge.svg?branch=staging)](https://github.com/dbca-wa/cannabis/actions/workflows/deploy-staging.yml)

  <!-- Coverage badges (uncomment when test coverage is established)
  ![Frontend Coverage](https://img.shields.io/badge/frontend--coverage-0%25-red)
  ![Backend Coverage](https://img.shields.io/badge/backend--coverage-0%25-red)
  -->
</div>

## System Overview

WIP: v1.0.0

The Cannabis system is a digital platform developed for DBCA's Herbarium. This application streamlines the documentation and certification of determinations made by Approved Botanists for suspected cannabis specimens, providing legally admissible evidence for law enforcement and court proceedings.

### Workflow Process

The primary purpose of this application is certificate generation from determination results. Approved Botanists perform their assessments on-site at police stations using Priority 3 forms, then the results are entered into this system for processing.

#### External Process (before the app)

1. Law enforcement officers collect suspected cannabis samples during operations
2. Officers contact DBCA Herbarium to arrange an assessment
3. An Approved Botanist\* travels to the police station, examines the specimens, and records determinations on a Priority 3 form with bag identification tags

#### In-App Process

1. **Case Creation** -- Finance Officer creates a case, entering details from the completed Priority 3 form (officer, defendant, and bag information)
2. **Assessment Entry** -- Determination results from the physical form are entered per bag (species, weight, determination outcome)
3. **Certificate Generation** -- The system generates unsigned PDF certificates from the entered data, ready for printing
4. **Batching** -- Completed cases are grouped into batches for invoicing and cost tracking and provided to finance officers via a zip file
5. **Completion** -- Certificates are printed and provided to the Approved Botanist for signing. After invoices are raised externally, the invoice number is recorded in-app

#### External Process (after the app)

1. Approved Botanist signs the printed certificates
2. Finance Officers scan signed certificates back into the system and send automated emails with certificate and police form attached
3. Endorsed certificates are delivered to police to serve as legal evidence for prosecution

## Technical Architecture

This application is built using a modern tech stack:

-   **Frontend**: React.js with responsive design for efficient use across devices
-   **Backend**: Django REST framework providing robust API endpoints
-   **Database**: PostgreSQL for secure, reliable data storage
-   **Authentication**: Multi-level access controls with role-based permissions. Utilises DBCA Utils for SSO
-   **Document Generation**: PrinceXML integration for creating maintainable and legally compliant PDF certificates with digital signatures

## Primary Tech Stack

-   **Frontend**: React, Vite, Bun, Typescript, Mobx, Tanstack Query, Tailwind, Shadcn, React Hook Form, Zod, Axios, React Helmet, React Router, React Icons
-   **Backend**: Django, Python, Celery, Redis, Django Rest Framework, PrinceXML

## Key Features

-   Extraction, transformation, and loading (ETL) of historical records from legacy systems into the new, well-structured database
-   Automated certificate generation with tamper-evident features
-   Task Dashboard with status updates on Submissions
-   Recordkeeping of costs involved and revenues, including adjustment of certication fee
-   \*(Limited) Integration capabilities with law enforcement systems (for requesting an assessment), providing an email trail for recordkeeping

## Purpose

This system modernises the cannabis identification workflow by replacing an outdated Microsoft Access database with a robust digital platform. It ensures seamless processing of specimen determinations while maintaining secure, court-admissible evidentiary records that meet legal standards for prosecution.

## Development Setup

This project has been setup to run entirely locally or in a Docker environment.
You can use docker-compose.dev.yml to establish a local docker setup (after run migrations and createsuperuser) or use bun and poetry:

```shell
  # From frontend folder after bun install
  bun run dev
```

```shell
  # From backend folder after poetry init/shell and install
  python manage.py runserver
```

---

\*Approved Botanists as defined in the [Misuse of Drugs Act 1981](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_46172.pdf/$FILE/Misuse%20Of%20Drugs%20Act%201981%20-%20%5B08-f0-02%5D.pdf?OpenElement) and the [Misuse of Drugs Amendment Act 1995](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_6749.pdf/$FILE/Misuse%20of%20Drugs%20Amendment%20Act%201995%20-%20%5B00-00-00%5D.pdf?OpenElement).
