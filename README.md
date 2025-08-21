# FHIR Gherkin Workbench

A lightweight web workbench for authoring, parsing, and validating **FHIR test scenarios** using a Gherkin-like DSL.  
The app converts Gherkin feature files into an **intermediate representation (IR)** and generates **GITB/ITB-compatible XML test cases**.  

This project is intended as a playground and authoring tool for testers, monitor developers, and engineers working with **FHIR conformance and interoperability testing**.

---

## ✨ Features

- **Gherkin parser**  
  Parses `.feature` text into structured scenarios with steps, tables, and inline comments stripped.  
  Supports `Feature`, `Background`, `Scenario`, `Given/When/Then/And/But`.

- **FHIR language catalog**  
  Loads step definitions from `/lang/en.yml`.  
  Each step may include:
  - Regex patterns for matching  
  - Required table columns  
  - Required services & version constraints (e.g. `FHIR-validator >=1.0`)  

- **Intermediate Representation (IR)**  
  Steps expand into IR actions (`call`, `verify`, `process`, `assign`, `listAppend`, `foreach`).

- **XML Generator**  
  Translates IR into `<testcase>` XML compatible with GITB/ITB.  

---

## 📂 Project Structure

```
src/
 ├─ App.tsx              # Main UI
 ├─ components/
 │   └─ OutputPanel.tsx  # Shows XML output
 ├─ parser/
 │   ├─ gherkinParser.ts # Gherkin → IR
 │   └─ xmlGenerator.ts  # IR → XML
 ├─ validation/
 │   └─ gitbValidator.ts # GITB schema checks
 ├─ data/
 │   └─ models.ts        # Example FHIR models
 └─ lang/
     └─ en.yml           # Step catalog (language definitions)
```

---


## 🧑‍💻 Usage

- Paste or type a **Gherkin scenario** into the editor  
- The parser will:
  - Parse → build AST
  - Expand → map to IR actions
  - Generate → `<testcase>` XML output
- Errors (missing mappings, missing services, wrong table headers) will appear inline.

---

## 📖 Language Notes

- Comments starting with `#` are ignored  
- Extended FHIR functions include:
  - `validate` (FHIR resource validation)
  - `fhirpath` (FHIRPath evaluation)
  - User-interaction steps (`informUser`, `informMonitor`, `pollForUploadSubmission`, etc.)  
- Step definitions are declared in `lang/en.yml` with optional `requires` (e.g. service + version).  

---

## ✅ Example

Input `.feature`:

```
Feature: Allergy Registry

Scenario: Submit allergy
  Given the server is initialized with setup data
  When the client submits an AllergyIntolerance resource
  Then the server validates the resource
  And the allergy is stored in the registry
```

Output XML:

```
<testcase name="Submit allergy">
  <call path="/fhir/AllergyIntolerance"/>
  <verify handler="FHIR-validator"/>
  <process handler="registry" operation="store"/>
</testcase>
```

---

## 🛠 Requirements

- Node.js 18+
- A modern browser
- (Optional) ITB instance with required services:
  - `FHIR-validator >= 1.0`
  - `Monitor >= 2.0`

---

## 📜 License

Creative Commons

