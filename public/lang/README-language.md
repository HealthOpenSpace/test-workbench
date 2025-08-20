# FHIR Gherkin Language for ITB

This document describes the **FHIR Gherkin dialect** supported by the Test Workbench.  
It is designed for authoring **FHIR client and server test scenarios** that run both in **ITB** and (optionally) in **Karate**.

---

## ✨ Key Features

- **Standard Gherkin support** (`Feature:`, `Scenario:`, `Given/When/Then`).
- **FHIR-specific testing steps** for resource submission, validation, and FHIRPath checks.
- **User interaction steps** for manual workflows (user actions, monitor validation).
- **Polling and proxying steps** for asynchronous workflows.
- **Configurable language catalog** (`en.yml`) mapping phrases → actions.
- **Requirements metadata** (`requires`) so authors know which ITB services/versions are needed.

---

## 📘 Supported Functions

### 1. Standard Gherkin
- `Feature`, `Background`, `Scenario`, `Scenario Outline`
- Step keywords: `Given`, `When`, `Then`, `And`, `But`
- Step tables for structured input
- Docstrings for JSON/XML snippets
- Comments: lines starting with `#` are ignored (inline comments also supported)

### 2. FHIR Testing Extensions
- **Validation**  
  ```
  Then the Patient resource is valid against profile "http://hl7.org/fhir/uv/ipa/StructureDefinition/ipa-patient"
  ```
  *Requires: service `FHIR-validator` version >=1.0*

- **Validation Results Simplification**  
  ```
  Then the validation results contain no errors
  ```

- **FHIRPath Evaluation**  
  ```
  Then the Patient resource at "name.given.first()" is "John"
  ```

### 3. User Interaction Extensions
- **Inform User**  
  ```
  When the user is instructed "Please create and submit a Patient resource"
  ```

- **Inform Monitor**  
  ```
  When the monitor is instructed "Please check if the submission was OK"
  ```
  *Requires: service `Monitor` version >=2.0*

- **Wait for Upload Submission**  
  ```
  Then wait for upload submission with id "12345" within 60 seconds
  ```
  *Requires: service `UploadProxy` version >=1.5*

- **Wait for Monitor Validation**  
  ```
  Then wait for monitor validation of submission "12345" within 60 seconds
  ```

### 4. Proxy & Polling
- Record and poll FHIR traffic flows for requests (e.g. POST Patient).  
  *Requires: Proxy service enabled.*

---

## 🛠 Requirements (`requires`)

In `en.yml`, steps may declare requirements:

```yaml
requires:
  service: FHIR-validator
  version: ">=1.0"
```

- **`service`**: ITB service or module required.  
- **`version`**: Minimum version needed.  
- The parser checks these and issues warnings if unsupported.  

This ensures that authors only use steps that their ITB instance can run.

---

## ✅ Example Scenario

```gherkin
Feature: Client submits and monitor validates an allergy
  Scenario: Client submission with monitor approval
    Given I create an allergy resource with:
      | resourceType        | codeCode  | codeDisplay          | reactionCode | reactionDisplay |
      | AllergyIntolerance  | 762952008 | Peanut (substance)   | 39579001     | Anaphylaxis     |
    When I submit the created allergy
    Then the resource is correctly uploaded to the server
    And the Patient resource is valid against profile "http://hl7.org/fhir/uv/ipa/StructureDefinition/ipa-patient"
    And the monitor is instructed "Please check if the submission was OK"
    And the monitor marks the submission as "Pass"
```

---

## 📂 Files

- `en.yml`: Catalog of supported steps + requirements
- `gherkinParser.ts`: Parser that expands steps using the catalog
- `xmlGenerator.ts`: Converts parsed scenarios to ITB XML
- `docs/README-language.md`: This file
