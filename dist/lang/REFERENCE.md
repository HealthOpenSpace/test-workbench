# Gherkin Step Language Reference (en)

> Auto-generated from `en.yml` — the canonical step catalog for the GITB test workbench.

---

## 1. Actor Declarations

Declare the participants in a test scenario — the system under test (SUT), supporting services, and validators. Each actor gets an identifier used throughout the scenario. Actors can optionally be associated with an actual endpoint URL and/or a canonical definition URL (e.g. an ActorDefinition or CapabilityStatement).

| Syntax | Description |
|--------|-------------|
| `<Actor> is the system under test` | Declare the system under test (SUT) |
| `<Actor> is the system under test on <endpoint>` | SUT with endpoint URL |
| `<Actor> is the system under test as defined by <canonical>` | SUT with canonical definition |
| `<Actor> is the system under test on <endpoint> as defined by <canonical>` | SUT with endpoint + canonical |
| `<Actor> is available` | Declare a service/actor |
| `<Actor> is available on <endpoint>` | Actor with endpoint URL |
| `<Actor> is available as defined by <canonical>` | Actor with canonical definition |
| `<Actor> is available on <endpoint> as defined by <canonical>` | Actor with endpoint + canonical |
| `<Actor> is available as "<name>"` | Actor with a descriptive display name |

**Example — testing a client against a known FHIR server and validator:**
```gherkin
Background:
  Given Client is the system under test on http://localhost:9000/fhir as defined by http://hl7.org/fhir/ActorDefinition/client
  And FHIRServer is available on http://hapi.fhir.org/baseR4 as defined by http://hl7.org/fhir/ActorDefinition/server
  And Validator is available
```

---

## 2. Setup / Background

Configure actors before the scenario runs. Use data pools to pre-populate a server with reference data (patients, practitioners, etc.) that the test cases rely on.

| Syntax | Description |
|--------|-------------|
| `<Actor> is configured` | Configure an actor with its defaults |
| `<Actor> is configured with data pool "<pool>"` | Configure an actor with a named data pool |

**Example — pre-load the FHIR server with a set of test patients:**
```gherkin
Background:
  Given FHIRServer is available
  And FHIRServer is configured with data pool "default"
```

---

## 3. Implementation Guide / Package Loading

Load FHIR Implementation Guide packages into a validator or server so that profiles, value sets, and other conformance resources are available for validation and test data generation.

| Syntax | Description |
|--------|-------------|
| `load implementation guide "<id-or-url>"` | Load an IG package into the validator |
| `load implementation guide "<id-or-url>" and verify` | Load an IG and verify it loaded successfully |
| `<Actor> is preloaded with package <packageId>` | Preload a package into a named actor |

**Example — ensure the Belgian allergy profile is available for validation:**
```gherkin
Background:
  Given Validator is available
  And Validator is preloaded with package hl7.fhir.be.allergy#1.1.2
```

---

## 4. Resource Creation & Submission

Create FHIR resources from tabular data and submit them to a server. The table columns use FHIR element paths (e.g. `AllergyIntolerance.code.coding.code`). After submission, you can assert the HTTP response status and inspect the OperationOutcome.

| Syntax | Description |
|--------|-------------|
| `<Actor> creates an allergy resource with:` | Create a resource from a data table |
| `<Actor> submits the created allergy` | Submit the created resource (implicit target) |
| `<Actor> submits the created allergy to <Target>` | Submit to a named target actor |
| `save the returned identifier as "<var>"` | Save the returned resource ID to a variable |
| `the resource is correctly uploaded to the server` | Assert POST succeeded (HTTP 201) |
| `the response status should be "<code>"` | Assert a specific HTTP status code |
| `the OperationOutcome at "<path>" should be "<value>"` | Assert a field in the OperationOutcome |

**Example — a client creates and submits an allergy, then checks the result:**
```gherkin
Given Client creates an allergy resource with:
  | resourceType       | AllergyIntolerance.code.coding.code | AllergyIntolerance.code.coding.display | AllergyIntolerance.code.text |
  | AllergyIntolerance | 762952008                           | Peanut (substance)                     | Allergic to peanuts          |
When Client submits the created allergy
Then the resource is correctly uploaded to the server
And save the returned identifier as "allergyId"
```

---

## 5. FHIR Validation (GF1, GF2)

Validate a FHIR resource against a StructureDefinition profile and inspect the resulting OperationOutcome. Supports both anonymous validation (validates the last submitted payload) and actor-targeted validation (routes the request to a specific validator actor).

| Syntax | Description |
|--------|-------------|
| `validate against <profileUrl>` | Validate the last payload against a profile |
| `the <Actor> validates it against <profileUrl>` | Actor-targeted validation |
| `the validation summary shows <N> errors and <N> warnings` | Assert error/warning counts (`should show` also accepted) |
| `the resource is valid` | Validate using `meta.profile` or the base resource type — assert zero errors |
| `"<var>" is valid` | Validate a named variable using its `meta.profile` or base type — assert zero errors |
| `the validation should pass` | Assert zero validation errors (after an explicit `validate against`) |
| `the validation should fail` | Assert at least one validation error |
| `the validation issues should contain "<message>"` | Assert a specific issue message exists |
| `the validation should have no "<severity>" issues` | Assert no issues of a given severity |

**Enhanced validation options:**

| Syntax | Description |
|--------|-------------|
| `validate against "<profile>" with best practice "<level>"` | Validate with best-practice warning level |
| `validate against "<profile>" with resource id "<id>"` | Validate requiring a resource id |
| `validate "<variable>" against "<profile>"` | Validate a named variable instead of the last payload |

**Example — validate a submission and assert it is clean:**
```gherkin
Then the validator validates it against http://hl7.org/fhir/StructureDefinition/AllergyIntolerance
And the validation summary shows 0 errors and 0 warnings
```

**Example — quick validation using `meta.profile` or the base resource type (no explicit profile URL needed):**
```gherkin
When Client submits the created allergy
Then the resource is valid

# Or for a named variable:
Given generate test data from profile "http://hl7.org/fhir/StructureDefinition/Patient" as "myPatient"
Then "myPatient" is valid
```

**Example — validate a named variable and expect failure:**
```gherkin
Then validate "badResource" against "http://hl7.org/fhir/StructureDefinition/Patient"
And the validation should fail
And the validation issues should contain "minimum required"
```

---

## 6. FHIRPath Evaluation (GF3)

Evaluate FHIRPath expressions against the last payload or a named variable. Use this to extract values, assert field contents, or check cardinality. Results can be saved to variables for later assertions.

| Syntax | Description |
|--------|-------------|
| `evaluate FHIRPath "<expr>" as "<var>"` | Evaluate and save result to a variable |
| `evaluate FHIRPath "<expr>" and expect "<value>"` | Evaluate and assert result equals a value |
| `evaluate FHIRPath "<expr>" on "<var>" and expect "<value>"` | Evaluate on a named variable and assert |
| `evaluate FHIRPath "<expr>" exists` | Assert the expression returns a non-empty result |
| `evaluate FHIRPath "<expr>" count is <N>` | Assert the number of results |
| `evaluate FHIRPath "<expr>" on "<var>" as "<outVar>"` | Evaluate on a named variable, save result |

**Example — extract and check SNOMED codes from a submitted allergy:**
```gherkin
And evaluate FHIRPath "AllergyIntolerance.code.coding.where(system='http://snomed.info/sct').code" as "snomedCodes"
And evaluate FHIRPath "AllergyIntolerance.code.coding.count()" and expect "1"
```

**Example — check that a generated Patient has a name:**
```gherkin
And evaluate FHIRPath "Patient.name.exists()" on "generatedPatient" and expect "true"
```

---

## 7. Monitor & User Interaction (GF4, GF5, GF7, GF9)

Support human-in-the-loop testing. Prompt the tester or a monitor to perform a manual action (e.g. review a submission), then wait for their verdict. This is used in conformance testing where an automated check is not sufficient and a human must confirm correct behavior.

| Syntax | Description |
|--------|-------------|
| `inform the user "<message>"` | Display a message to the tester |
| `inform the monitor "<message>"` | Display a message to the monitor |
| `wait for monitor validation within <N> seconds` | Poll for the monitor's Pass/Fail decision |
| `the monitor is instructed to review the submission` | Instruct the monitor to review |
| `the monitor marks the submission as "Pass"` or `"Fail"` | Assert the monitor's decision |

**Example — ask a monitor to visually confirm a submission, then wait for their verdict:**
```gherkin
And inform the monitor "Please review the allergy submission for clinical correctness"
And wait for monitor validation within 60 seconds
And the monitor marks the submission as "Pass"
```

---

## 8. Proxy Traffic / Polling (GF6, GF8)

Observe HTTP traffic flowing through a proxy. Capture a baseline count, then poll for new requests matching specific methods or content filters. Use this to verify that the SUT actually sends the expected requests.

| Syntax | Description |
|--------|-------------|
| `capture initial traffic count` | Snapshot the current traffic count as a baseline |
| `wait for a new request with methods "<methods>" and filter "<filter>" within <N> seconds every <M> seconds` | Poll for a matching HTTP request |
| `wait for upload submission with id "<id>" within <N> seconds every <M> seconds` | Poll for a file upload |

**Example — verify the client sends a POST to the server:**
```gherkin
Given capture initial traffic count
When Client submits the created allergy
Then wait for a new request with methods "POST" and filter "AllergyIntolerance" within 30 seconds every 5 seconds
```

---

## 9. Wait for Actor Call

Wait for an asynchronous call to arrive at a named actor. Use this when the SUT is expected to call an external service (e.g. a terminology server or a notification endpoint) as a side effect of a previous action.

| Syntax | Description |
|--------|-------------|
| `wait for a call to "<actor>" within <N> seconds` | Wait for any call to a named actor |
| `wait for a call matching "<pattern>" to "<actor>" within <N> seconds` | Wait for a call matching a specific pattern |

**Example — verify the SUT calls the terminology server during validation:**
```gherkin
When Client submits the created allergy
Then wait for a call matching "ValueSet/$expand" to "TerminologyServer" within 30 seconds
```

---

## 10. Match / Comparison

Compare a resource or payload against an expected pattern. Supports full match (every element must match), partial match (only specified elements are checked, extras are allowed), and mismatch assertions (expect the comparison to fail). Patterns can be provided as tables, inline JSON, or doc strings.

| Syntax | Description |
|--------|-------------|
| `match "<var>" against expected:` | Full match against a table |
| `partially match "<var>" against expected:` | Partial match — extras allowed |
| `match "<var>" against pattern "<json>"` | Match against an inline JSON pattern |
| `the submission should match:` | Match the last submission against a table pattern |
| `compare "<var>" against expected as "<resultVar>"` | Compare and capture the result for inspection |
| `partially match "<var>" against:` | Partial match using a doc string |
| `exactly match "<var>" against:` | Exact match using a doc string |
| `"<var>" should NOT match:` | Assert mismatch (doc string) |
| `"<var>" should not match pattern "<json>"` | Assert mismatch (inline) |

**Example — check that a generated Patient contains the expected identifier:**
```gherkin
Then partially match "generatedPatient" against expected:
  | path                            | value                  |
  | Patient.identifier[0].system    | http://example.org/ids |
  | Patient.identifier[0].value     | 12345                  |
```

**Example — assert that a resource does NOT match a wrong pattern:**
```gherkin
Then "generatedPatient" should not match pattern '{"gender": "unknown"}'
```

---

## 11. Test Data Generation

Generate synthetic FHIR resources from a StructureDefinition profile. You can provide mappings (FHIR path to element), data tables (values to populate), or combine both. Useful for creating valid test instances without hand-crafting JSON.

| Syntax | Description |
|--------|-------------|
| `generate test data from profile "<profile>"` | Generate a resource with random valid data |
| `generate test data from profile "<profile>" as "<var>"` | Generate and save to a variable |
| `generate test data from profile "<profile>" with:` | Generate with inline path/value table |
| `generate test data from profile "<profile>" with mappings "<m>" and data "<d>"` | Generate using named mappings + data |
| `generate test data from profile "<profile>" with mappings "<m>" and data "<d>" as "<var>"` | Same, saving to a variable |
| `generate test bundle from profile "<profile>" with data "<d>"` | Generate a Bundle resource |
| `generate test bundle from profile "<profile>" with mappings "<m>" and data "<d>"` | Generate a Bundle with mappings |
| `generate and validate test data from profile "<profile>"` | Generate then immediately validate |

**Reusable definitions — define mappings and data once, reuse across scenarios:**

| Syntax | Description |
|--------|-------------|
| `define mappings "<name>":` | Define named FHIR-path-to-element mappings (table) |
| `define mappings "<name>" with parts:` | Define mappings for complex types (Identifier, HumanName, etc.) |
| `define data "<name>":` | Define a named reusable data table |

**Example — generate a Belgian Patient with specific values using inline FHIR paths as columns:**
```gherkin
Given generate test data from profile "https://www.ehealth.fgov.be/standards/fhir/core/StructureDefinition/be-patient" with:
  | Patient.name.given | Patient.name.family | Patient.birthDate | Patient.gender |
  | Jan                | Pansen              | 1990-05-15        | male           |
```

**Example — define reusable mappings (FHIR path → data column) and data, then generate:**
```gherkin
Given define mappings "patientMappings":
  | path              | expression           |
  | Patient.name      | column('familyName') |
  | Patient.gender    | column('sex')        |
And define data "patients":
  | familyName | sex    |
  | Pansen     | male   |
  | Dubois     | female |
When generate test data from profile "http://hl7.org/fhir/StructureDefinition/Patient" with mappings "patientMappings" and data "patients" as "testPatient"
```

**Example — mappings with parts for complex types (Identifier, HumanName):**
```gherkin
Given define mappings "patientMappings" with parts:
  | path                    | part   | expression                                                         |
  | Patient.identifier:SSIN | system | 'https://www.ehealth.fgov.be/standards/fhir/core/NamingSystem/ssin' |
  | Patient.identifier:SSIN | value  | column('ssin')                                                      |
  | Patient.name            | family | column('family')                                                    |
  | Patient.name            | given  | column('given')                                                     |
```

---

## 12. Variables & Assertions

Assign values to named variables, define resources from inline JSON, and make assertions on variable contents. Use JSON Pointer expressions to extract nested values from complex resources.

| Syntax | Description |
|--------|-------------|
| `define resource "<var>" as:` | Define a resource variable from inline JSON (doc string) |
| `set "<var>" to "<value>"` | Assign a string value to a variable |
| `the value of "<var>" is "<expected>"` | Assert variable equals a value |
| `the value of "<var>" contains "<substring>"` | Assert variable contains a substring |
| `the value of "<var>" is not empty` | Assert variable is non-empty |
| `extract "<pointer>" from "<var>" as "<outVar>"` | Extract a value using a JSON Pointer path |

**Example — define a resource inline and extract a field:**
```gherkin
Given define resource "myPatient" as:
  """
  {
    "resourceType": "Patient",
    "name": [{"given": ["Jan"], "family": "Pansen"}],
    "birthDate": "1990-05-15"
  }
  """
Then extract "/name/0/family" from "myPatient" as "familyName"
And the value of "familyName" is "Pansen"
```

**Example — set and check a simple variable:**
```gherkin
Given set "expectedCode" to "762952008"
Then the value of "expectedCode" is "762952008"
```

---

## 13. Resource Type Assertions

Quick assertions on the `resourceType` field of a generated or named resource. Useful as a sanity check after test data generation.

| Syntax | Description |
|--------|-------------|
| `the "<var>" resource type should be "<type>"` | Assert resourceType of a named variable |
| `the generated resource type should be "<type>"` | Assert resourceType of the last generated resource |

**Example — verify the generated resource is a Patient:**
```gherkin
Given generate test data from profile "http://hl7.org/fhir/StructureDefinition/Patient" as "testPatient"
Then the "testPatient" resource type should be "Patient"
```

---

## 14. HCERT / QR Code Validation

Steps for validating EU Digital COVID Certificate (HCERT) QR codes and their CBOR Web Token (CWT) payloads. Covers the full verification pipeline: QR scanning, Base45 decoding, ZLIB decompression, CWT parsing, algorithm/key validation, signature verification, and HCERT payload extraction.

| Syntax | Description |
|--------|-------------|
| `a Receiver is presented a QR Code` | Setup: present a QR code to the receiver |
| `the QR code uses a format as defined in (ISO/IEC 18004:2015)` | Assert QR format compliance |
| `the QR code uses Alphanumeric mode (Mode 2) encoding` | Assert encoding mode |
| `the QR code uses Base45 encoding` | Assert Base45 encoding |
| `the Receiver scans the QR Code` | Scan and decode the QR code |
| `the QR code is successfully decoded` | Assert decode success |
| `the decoded raw Alphanumeric string starts with "HC1:" prefix` | Assert HC1 prefix present |
| `the decoded raw Alphanumeric string does not start with "HC1:" prefix` | Assert HC1 prefix absent |
| `the QR Code is rejected with an Error` | Assert QR code rejection |
| `Receiver decodes the raw Alphanumeric string from QR Code` | Decode the alphanumeric string |
| `removes the "HC1:" prefix` | Strip the HC1 prefix |
| `the remaining Alphanumeric string can be Base45 decoded to retrieve a binary payload` | Base45 decode to binary |
| `ZLIB decompression can be applied to the binary payload` | Decompress the binary payload |
| `the retrieved Payload is a valid CBOR Web Token (CWT) as defined [here](<url>)` | Validate CWT structure |
| `a valid CBOR CWT token is decoded from a QR Code` | Setup: assume a decoded CWT |
| `THE CWT is parsed` | Parse the CWT structure |
| `CWT structure validates against the StructureDefinition as defined [here](<url>)` | Validate CWT against a profile |
| `a valid CWT` | Setup: assume a valid CWT |
| `the Receiver validates the algorithm i.e. Claim '1' in the Header` | Validate the algorithm claim |
| `the algorithm is be one of the supported types:` | Assert algorithm type (table follows) |
| `a valid CWT Structure` | Setup: assume valid CWT structure |
| `the Receiver extracts the Key Identifier i.e. Claim '4' in the Header` | Extract Key ID |
| `extracts the Issuer i.e. Claim '1' from the Payload` | Extract issuer country |
| `the extracted Key Id is 8 bytes` | Assert Key ID length |
| `the extracted issuer is ISO 3166-1 alpha-2 Country Code` | Assert issuer format |
| `the public key can be retrieved from the trust network using the Country Code and Key Id` | Retrieve public key from trust list |
| `the Receiver extracts the public key of the issuer from the trust network that matches the Key Id in the COSE Header` | Extract public key |
| `the payload has not expired i.e. current time is between Issued at (Claim '6') and  Expiration Date (Claim '4')` | Check token expiry |
| `the signature is cryptographically valid` | Verify COSE signature |
| `a CWT with verified signature` | Setup: assume verified CWT |
| `the Receiver extracts the HCERT Payload using claim key -260` | Extract the HCERT payload |
| `the extracted HCERT structure validates against the StructureDefinition as defined [here](<url>)` | Validate HCERT against a profile |

**Example — full QR code verification flow:**
```gherkin
Given a Receiver is presented a QR Code
And the QR code uses Base45 encoding
When the Receiver scans the QR Code
Then the QR code is successfully decoded
And the decoded raw Alphanumeric string starts with "HC1:" prefix
And removes the "HC1:" prefix
And the remaining Alphanumeric string can be Base45 decoded to retrieve a binary payload
And ZLIB decompression can be applied to the binary payload
And the retrieved Payload is a valid CBOR Web Token (CWT) as defined [here](https://example.org/cwt-spec)
```

---

## Syntax Notes

- **Inline comments**: text after `#` (outside quotes) is stripped — use for annotations: `And validate against http://... # GF1`
- **Doc strings**: triple-quoted blocks (`"""`) for inline JSON or multi-line content
- **Tables**: pipe-delimited (`| col1 | col2 |`) with header row followed by data rows
- **Actors**: `PascalCase` or `camelCase` identifiers — matched by the `[A-Za-z][A-Za-z0-9_]*` pattern
- **URLs**: both `http://` and `https://` are accepted wherever `<endpoint>`, `<canonical>`, or `<profileUrl>` appear
