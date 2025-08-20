Feature: Client submits and monitor validates an allergy
  As a client
  I want to submit an allergy and have a monitor approve it
  So that the test step is completed

  Background:
    Given the test session is set up with dataset ingestion "Y" and server api root from SYSTEM

  Scenario: tc-client-001 Client submission with monitor approval
    Given I create an allergy resource with:
      | resourceType        | codeCode  | codeDisplay        | codeText              | reactionCode | reactionDisplay |
      | AllergyIntolerance  | 762952008 | Peanut (substance) | Allergic to peanuts   | 39579001     | Anaphylactic    |
    When I submit the created allergy
    Then the resource is correctly uploaded to the server
    And validate against http://hl7.org/fhir/StructureDefinition/AllergyIntolerance  # GF1
    And the validation summary should show 0 errors and 0 warnings                                            
    And evaluate FHIRPath "AllergyIntolerance.code.coding.where(system='http://snomed.info/sct').code" as "codes" # GF3
    And inform the monitor "Please review the submission"                                                        # GF5
    And wait for monitor validation within 60 seconds                                                             # GF7/GF9
    And the monitor marks the submission as "Pass"