<div align="center">
  <img src="favicon.svg" alt="C" width="350" height="350"/>
  <div>👮 → 📞 → 👩‍🔬 → 📅 → 🔬 → 💻 → 📄 → ✅ → 🏛️</div>
</div>

## System Overview

WIP: The Cannabis system is a digital platform developed for DBCA's Herbarium. This application streamlines the documentation and certification of determinations made by Approved Botanists for suspected cannabis specimens, providing legally admissible evidence for law enforcement and court proceedings.

### Workflow Process

The overall process is submission, determination, and certification. Here is a detailed breakdown:

1. **Police Collection** (👮): Law enforcement officers collect suspected cannabis samples during operations
2. **Case Initiation** (📞): Officers contact DBCA Herbarium to initiate the identification process
3. **Scientist Assignment** (👩‍🔬): Approved Botanists within the meaning of Acts\* are assigned to the case
4. **Appointment Set** (📅): A time and location is set for the Approved Botanist to travel to and assess the specimens
5. **Laboratory Analysis** (🔬): Approved Botanist examines the product at the specified location, marking determintions on a police form with bag identification tags
6. **Digital Processing** (💻): Form passed on to BCS Finance Officers. Results are entered into the system's secure database, along with any attachments
7. **Certificate Generation** (📄): System saves and outputs unsigned certificate/s, which are printed and provided to Approved Botanist (If erroneous, Approved Botanist uses system to request changes)
8. **Final Sign Off** (✅): Approved Botanist signs and provides copies to Finance Officers to scan back into our system and send automated email of certificate and police form attached
9. **Court Proceedings** (🏛️): Endorsed Certificate/s hand-delivered back to police to serve as legal evidence for prosecution

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

---

\*Approved Botanists as defined in the [Misuse of Drugs Act 1981](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_46172.pdf/$FILE/Misuse%20Of%20Drugs%20Act%201981%20-%20%5B08-f0-02%5D.pdf?OpenElement) and the [Misuse of Drugs Amendment Act 1995](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_6749.pdf/$FILE/Misuse%20of%20Drugs%20Amendment%20Act%201995%20-%20%5B00-00-00%5D.pdf?OpenElement).
