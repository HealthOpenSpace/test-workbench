import { DataModel, ExampleScenario } from '../types';

export const dataModels: DataModel[] = [
  {
    id: 'fhir',
    name: 'FHIR R4',
    description: 'Fast Healthcare Interoperability Resources R4',
    baseUrl: 'http://hl7.org/fhir',
    extensions: {
      GF1: {
        id: 'GF1',
        name: 'Resource Validation',
        description: 'Validate FHIR resources against StructureDefinitions',
        stepMappings: {
          'validate against (.*)': 'validate',
          'the resource should be valid': 'validate',
          'validate the (.*) resource': 'validate'
        }
      },
      GF2: {
        id: 'GF2',
        name: 'Resource Creation',
        description: 'Create and submit FHIR resources',
        stepMappings: {
          'the user submits a (.*) resource': 'waitForUpload',
          'submit a (.*) resource': 'waitForUpload',
          'create a (.*) resource': 'waitForUpload'
        }
      },
      GF3: {
        id: 'GF3',
        name: 'Information Display',
        description: 'Display information to users',
        stepMappings: {
          'inform the user (.*)': 'informUser',
          'display message (.*)': 'informUser',
          'show (.*)': 'informUser'
        }
      },
      GF4: {
        id: 'GF4',
        name: 'Response Polling',
        description: 'Poll for responses and status updates',
        stepMappings: {
          'poll for (.*)': 'poll',
          'wait for response': 'poll',
          'check status': 'poll'
        }
      }
    }
  },
  {
    id: 'kmehr',
    name: 'KMEHR',
    description: 'Kind Messages for Electronic Healthcare Records',
    extensions: {
      GK1: {
        id: 'GK1',
        name: 'KMEHR Validation',
        description: 'Validate KMEHR messages',
        stepMappings: {
          'validate KMEHR message': 'validate',
          'the KMEHR should be valid': 'validate'
        }
      },
      GK2: {
        id: 'GK2',
        name: 'KMEHR Processing',
        description: 'Process KMEHR transactions',
        stepMappings: {
          'process KMEHR transaction': 'waitForUpload',
          'submit KMEHR (.*)': 'waitForUpload'
        }
      }
    }
  },
  {
    id: 'openehr',
    name: 'openEHR',
    description: 'Open Electronic Health Records',
    extensions: {
      GO1: {
        id: 'GO1',
        name: 'Archetype Validation',
        description: 'Validate against openEHR archetypes',
        stepMappings: {
          'validate against archetype (.*)': 'validate',
          'the composition should conform to (.*)': 'validate'
        }
      },
      GO2: {
        id: 'GO2',
        name: 'Composition Creation',
        description: 'Create openEHR compositions',
        stepMappings: {
          'create composition (.*)': 'waitForUpload',
          'submit composition': 'waitForUpload'
        }
      }
    }
  }
];

export const exampleScenarios: ExampleScenario[] = [
  {
    id: 'validate-patient',
    name: 'Validate Patient',
    description: 'Basic FHIR Patient resource validation',
    dataModel: 'fhir',
    content: `Feature: Patient Resource Validation

Scenario: Validate a basic Patient resource
    Given the user submits a Patient resource
    When the resource is processed
    Then validate against http://hl7.org/fhir/StructureDefinition/Patient
    And inform the user "Patient resource is valid"
    And the validation should succeed`
  },
  {
    id: 'create-observation',
    name: 'Create Observation',
    description: 'Create and validate FHIR Observation',
    dataModel: 'fhir',
    content: `Feature: Observation Resource Creation

Scenario: Create a vital signs observation
    Given the user submits an Observation resource
    When the resource contains vital signs data
    Then validate against http://hl7.org/fhir/StructureDefinition/Observation
    And poll for processing status
    And inform the user "Observation created successfully"`
  },
  {
    id: 'kmehr-prescription',
    name: 'KMEHR Prescription',
    description: 'Process KMEHR prescription message',
    dataModel: 'kmehr',
    content: `Feature: KMEHR Prescription Processing

Scenario: Process electronic prescription
    Given the user submits a KMEHR prescription
    When the prescription is validated
    Then validate KMEHR message
    And process KMEHR transaction
    And inform the user "Prescription processed"`
  },
  {
    id: 'openehr-composition',
    name: 'openEHR Composition',
    description: 'Validate openEHR composition',
    dataModel: 'openehr',
    content: `Feature: openEHR Composition Validation

Scenario: Validate clinical composition
    Given the user creates a clinical composition
    When the composition is submitted
    Then validate against archetype openEHR-EHR-COMPOSITION.encounter.v1
    And the composition should be valid
    And inform the user "Composition validated successfully"`
  }
];