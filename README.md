<div align="center">
<h1>
  🧪 Cannabis 🧪
  <br/>
  <br/>

👮 → 📞 → 👩‍🔬 → 📅 → 🔬 → 💻 → 📄 → ✅ → 🏛️
<br/>

</h1>
</div>

## System Overview

Current State: WIP

The Cannabis system is a comprehensive digital platform developed in collaboration with the WA Police Force and WA Herbarium. This specialised application streamlines the scientific identification process for suspected cannabis specimens, providing legally admissible, certified determinations for law enforcement and court proceedings.

### Workflow Process

The overall process is submission, determination, and certification. Here is a detailed breakdown:

1. **Police Collection** (👮): Law enforcement officers collect suspected cannabis samples during operations
2. **Case Initiation** (📞): Officers contact the forensic team to initiate the identification process
3. **Scientist Assignment** (👩‍🔬): Approved Botanists within the meaning of Acts\* are assigned to the case
4. **Appointment Set** (📅): A time and location is set for the Approved Botanist to travel to and assess the specimens
5. **Laboratory Analysis** (🔬): Detailed scientific examination using established taxonomic protocols at the location
6. **Digital Processing** (💻): Results entered into the system's secure database, along with any attachments
7. **Certificate Generation** (📄): Output is a PrinceXML certificate, which is digitally-signed by Approved Botanist
8. **Final Sign Off** (✅): Finance Officers sign off and Cannabis system produces final PDF certificate which is provided to Police Force
9. **Court Proceedings** (🏛️): Certificates serve as legal evidence for prosecution

## Technical Architecture

This application is built using a modern tech stack:

-   **Frontend**: React.js with responsive design for efficient use across devices
-   **Backend**: Django REST framework providing robust API endpoints
-   **Database**: PostgreSQL for secure, reliable data storage
-   **Authentication**: Multi-level access controls with role-based permissions. Utilises DBCA Utils for SSO
-   **Document Generation**: PrinceXML integration for creating maintainable and legally compliant PDF certificates with digital signatures

## Key Features

-   Extraction, transformation, and loading (ETL) of historical records from legacy systems into the new, well-structured database
-   Standardised scientific determination workflows based on botanical protocols
-   Automated certificate generation with tamper-evident features
-   Task Dashboard with status updates on Submissions
-   Integration capabilities with other law enforcement systems
-   Compliance with evidence handling requirements and legal standards; documents are securely stored in containerized storage volumes

## Purpose

This system modernises the cannabis identification workflow by replacing an outdated Microsoft Access database with a robust digital platform. It ensures seamless processing of specimen determinations while maintaining secure, court-admissible evidentiary records that meet legal standards for prosecution.

---

\*Approved Botanists as defined in the [Misuse of Drugs Act 1981](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_46172.pdf/$FILE/Misuse%20Of%20Drugs%20Act%201981%20-%20%5B08-f0-02%5D.pdf?OpenElement) and the [Misuse of Drugs Amendment Act 1995](https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_6749.pdf/$FILE/Misuse%20of%20Drugs%20Amendment%20Act%201995%20-%20%5B00-00-00%5D.pdf?OpenElement).
