Feature: FHIR server allergy flows
  As a FHIR server
  I want to handle valid and invalid allergy submissions
  So that clients see correct outcomes

  Background:
    Given the test session is set up with dataset ingestion "Y" and server api root from SYSTEM

  Scenario: tc-server-001 Submit two allergies and verify
    When I register an allergy with:
      | codeCode  | codeDisplay            | codeText               | reactionCode | reactionDisplay        |
      | 762952008 | Peanut (substance)     | Allergic to peanut     | 39579001     | Anaphylactic reaction  |
    And save the returned identifier as "registeredIdentifier1"

    When I register an allergy with:
      | codeCode  | codeDisplay             | codeText                 | reactionCode | reactionDisplay        |
      | 227346004 | Chick peas (substance)  | Allergic to chick peas   | 39579001     | Anaphylactic reaction  |
    And save the returned identifier as "registeredIdentifier2"

    Then the patient's registered allergies should include:
      | code      | identifier             |
      | 762952008 | $registeredIdentifier1 |
      | 227346004 | $registeredIdentifier2 |

  Scenario: tc-server-002 Reject invalid allergy due to wrong resource type
    Given I create an allergy resource with:
      | resourceType           | codeCode  | codeDisplay          | codeText            | reactionCode | reactionDisplay        |
      | AllergyIntoleranceXXX  | 762952008 | Peanut (substance)   | Allergic to peanut  | 39579001     | Anaphylactic reaction  |
    When I submit the created allergy
    Then the response status should be "400"
    And the OperationOutcome at "/issue/0/severity" should be "error"
