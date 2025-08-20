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
          'validate the (.*) resource': 'validate',
          'the validation should succeed': 'validate',
          'validation should be successful': 'validate',
          'should pass validation': 'validate'
        }
      },
      GF2: {
        id: 'GF2',
        name: 'Resource Creation',
        description: 'Create and submit FHIR resources',
        stepMappings: {
          'the user submits a (.*) resource': 'waitForUpload',
          'submit a (.*) resource': 'waitForUpload',
          'create a (.*) resource': 'waitForUpload',
          'I submit the (.*) resource': 'waitForUpload',
          'upload a (.*) resource': 'waitForUpload'
        }
      },
      GF3: {
        id: 'GF3',
        name: 'Information Display',
        description: 'Display information to users',
        stepMappings: {
          'inform the user (.*)': 'informUser',
          'display message (.*)': 'informUser',
          'show (.*)': 'informUser',
          'notify the user (.*)': 'informUser',
          'tell the user (.*)': 'informUser'
        }
      },
      GF4: {
        id: 'GF4',
        name: 'Response Polling',
        description: 'Poll for responses and status updates',
        stepMappings: {
          'poll for (.*)': 'poll',
          'wait for response': 'poll',
          'check status': 'poll',
          'monitor for (.*)': 'poll'
        }
      },
      GF5: {
        id: 'GF5',
        name: 'Processing Steps',
        description: 'General processing and workflow steps',
        stepMappings: {
          'the resource is processed': 'custom',
          'process the (.*)': 'custom',
          'handle the (.*)': 'custom',
          'execute (.*)': 'custom',
          'perform (.*)': 'custom',
          'the system processes (.*)': 'custom',
          'processing completes': 'custom',
          'the workflow continues': 'custom'
        }
      }
    }
  },
  {
    id: 'EIRA',
    name: 'EIRA',
    description: 'European Interoperability Reference Architecture',
    baseUrl: 'https://ec.europa.eu/isa2/eif',
    extensions: {
      EI1: {
        id: 'EI1',
        name: 'Legal Interoperability',
        description: 'Ensure legal compatibility and compliance',
        stepMappings: {
          'check legal compliance': 'validate',
          'verify regulatory requirements': 'validate',
          'ensure GDPR compliance': 'validate'
        }
      },
      EI2: {
        id: 'EI2',
        name: 'Organizational Interoperability',
        description: 'Align business processes and responsibilities',
        stepMappings: {
          'align business processes': 'custom',
          'coordinate organizations': 'custom',
          'establish governance': 'custom'
        }
      },
      EI3: {
        id: 'EI3',
        name: 'Semantic Interoperability',
        description: 'Ensure precise meaning of data exchange',
        stepMappings: {
          'validate semantic meaning': 'validate',
          'check data definitions': 'validate',
          'verify terminology mapping': 'validate'
        }
      },
      EI4: {
        id: 'EI4',
        name: 'Technical Interoperability',
        description: 'Enable technical connectivity and data exchange',
        stepMappings: {
          'establish technical connection': 'custom',
          'validate data formats': 'validate',
          'test system integration': 'custom'
        }
      }
    }
  },
  {
    id: 'smart-guidelines',
    name: 'SMART Guidelines',
    description: 'WHO SMART Guidelines Reference Architecture for Digital Health',
    baseUrl: 'https://smart.who.int',
    extensions: {
      SG1: {
        id: 'SG1',
        name: 'Clinical Decision Support',
        description: 'Implement evidence-based clinical decision support',
        stepMappings: {
          'execute clinical decision support': 'custom',
          'apply clinical guidelines': 'custom',
          'evaluate clinical rules': 'validate',
          'trigger clinical alerts': 'informUser',
          'provide clinical recommendations': 'informUser',
          'assess clinical indicators': 'validate'
        }
      },
      SG2: {
        id: 'SG2',
        name: 'Data Collection and Management',
        description: 'Standardized data collection following SMART Guidelines',
        stepMappings: {
          'collect patient data': 'waitForUpload',
          'validate data quality': 'validate',
          'standardize data elements': 'custom',
          'ensure data completeness': 'validate',
          'apply data validation rules': 'validate',
          'manage health data': 'custom'
        }
      },
      SG3: {
        id: 'SG3',
        name: 'Care Planning and Workflows',
        description: 'Implement standardized care pathways and workflows',
        stepMappings: {
          'create care plan': 'custom',
          'update care pathway': 'custom',
          'execute workflow step': 'custom',
          'transition care stage': 'custom',
          'coordinate care activities': 'custom',
          'monitor care progress': 'poll'
        }
      },
      SG4: {
        id: 'SG4',
        name: 'Quality Assurance and Monitoring',
        description: 'Monitor quality indicators and outcomes',
        stepMappings: {
          'calculate quality indicators': 'custom',
          'monitor health outcomes': 'poll',
          'assess program performance': 'validate',
          'generate quality reports': 'custom',
          'track key metrics': 'poll',
          'evaluate effectiveness': 'validate'
        }
      },
      SG5: {
        id: 'SG5',
        name: 'Interoperability and Standards',
        description: 'Ensure interoperability using international standards',
        stepMappings: {
          'validate FHIR compliance': 'validate',
          'check HL7 standards': 'validate',
          'ensure terminology binding': 'validate',
          'validate code systems': 'validate',
          'test interoperability': 'custom',
          'exchange health information': 'custom'
        }
      }
    }
  },
  {
    id: 'smart-l2-sop',
    name: 'SMART Guidelines L2 SOPs',
    description: 'Level 2 Standard Operating Procedures for SMART Guidelines (Narrative Requirements)',
    baseUrl: 'https://smart.who.int/sop/l2',
    extensions: {
      L2SOP1: {
        id: 'L2SOP1',
        name: 'Health Program Requirements Analysis',
        description: 'Analyze and document health program narrative requirements',
        stepMappings: {
          'analyze health program objectives': 'custom',
          'document clinical workflows': 'custom',
          'identify key health indicators': 'custom',
          'define care pathways': 'custom',
          'establish program governance': 'custom',
          'validate program requirements': 'validate'
        }
      },
      L2SOP2: {
        id: 'L2SOP2',
        name: 'Clinical Decision Support Requirements',
        description: 'Define clinical decision support narrative requirements',
        stepMappings: {
          'identify clinical decision points': 'custom',
          'document clinical algorithms': 'custom',
          'define alert conditions': 'custom',
          'specify recommendation logic': 'custom',
          'establish clinical thresholds': 'custom',
          'validate clinical rules': 'validate'
        }
      },
      L2SOP3: {
        id: 'L2SOP3',
        name: 'Data Requirements Specification',
        description: 'Specify health data collection and management requirements',
        stepMappings: {
          'identify required data elements': 'custom',
          'define data collection points': 'custom',
          'specify data validation rules': 'custom',
          'establish data quality criteria': 'custom',
          'document data workflows': 'custom',
          'validate data requirements': 'validate'
        }
      },
      L2SOP4: {
        id: 'L2SOP4',
        name: 'User Experience Requirements',
        description: 'Define user interface and experience requirements',
        stepMappings: {
          'analyze user personas': 'custom',
          'document user journeys': 'custom',
          'specify interface requirements': 'custom',
          'define accessibility standards': 'custom',
          'establish usability criteria': 'custom',
          'validate user requirements': 'validate'
        }
      },
      L2SOP5: {
        id: 'L2SOP5',
        name: 'System Integration Requirements',
        description: 'Define system integration and interoperability requirements',
        stepMappings: {
          'identify integration points': 'custom',
          'specify data exchange requirements': 'custom',
          'define interoperability standards': 'custom',
          'establish security requirements': 'custom',
          'document integration workflows': 'custom',
          'validate integration requirements': 'validate'
        }
      }
    }
  },
  {
    id: 'smart-l3-sop',
    name: 'SMART Guidelines L3 SOPs',
    description: 'Level 3 Standard Operating Procedures for SMART Guidelines (Machine-Readable Specifications)',
    baseUrl: 'https://smart.who.int/sop/l3',
    extensions: {
      L3SOP1: {
        id: 'L3SOP1',
        name: 'FHIR Implementation Guide Development',
        description: 'Develop machine-readable FHIR Implementation Guides',
        stepMappings: {
          'create FHIR profiles': 'custom',
          'define value sets': 'custom',
          'specify code systems': 'custom',
          'create capability statements': 'custom',
          'validate FHIR resources': 'validate',
          'publish implementation guide': 'custom'
        }
      },
      L3SOP2: {
        id: 'L3SOP2',
        name: 'Clinical Quality Language (CQL) Development',
        description: 'Develop executable clinical logic using CQL',
        stepMappings: {
          'author CQL libraries': 'custom',
          'define clinical expressions': 'custom',
          'implement decision logic': 'custom',
          'create quality measures': 'custom',
          'test CQL execution': 'validate',
          'validate clinical algorithms': 'validate'
        }
      },
      L3SOP3: {
        id: 'L3SOP3',
        name: 'FHIR Questionnaire Development',
        description: 'Create structured data collection forms using FHIR Questionnaires',
        stepMappings: {
          'design questionnaire structure': 'custom',
          'define question items': 'custom',
          'specify answer options': 'custom',
          'implement conditional logic': 'custom',
          'validate questionnaire': 'validate',
          'test form functionality': 'validate'
        }
      },
      L3SOP4: {
        id: 'L3SOP4',
        name: 'PlanDefinition and ActivityDefinition',
        description: 'Create executable care plans and activities',
        stepMappings: {
          'create plan definitions': 'custom',
          'define activity definitions': 'custom',
          'specify action conditions': 'custom',
          'implement workflow logic': 'custom',
          'validate plan execution': 'validate',
          'test care plan workflows': 'validate'
        }
      },
      L3SOP5: {
        id: 'L3SOP5',
        name: 'Measure and Library Development',
        description: 'Develop quality measures and reusable logic libraries',
        stepMappings: {
          'create measure resources': 'custom',
          'define measure populations': 'custom',
          'implement scoring logic': 'custom',
          'create reusable libraries': 'custom',
          'validate measure calculations': 'validate',
          'test quality reporting': 'validate'
        }
      },
      L3SOP6: {
        id: 'L3SOP6',
        name: 'Testing and Validation Framework',
        description: 'Implement comprehensive testing for machine-readable artifacts',
        stepMappings: {
          'create test cases': 'custom',
          'implement unit tests': 'validate',
          'perform integration testing': 'validate',
          'validate against test data': 'validate',
          'execute conformance testing': 'validate',
          'verify interoperability': 'validate'
        }
      },
      L3SOP7: {
        id: 'L3SOP7',
        name: 'Terminology Management',
        description: 'Manage and maintain clinical terminologies and code systems',
        stepMappings: {
          'maintain code systems': 'custom',
          'update value sets': 'custom',
          'manage concept maps': 'custom',
          'validate terminology bindings': 'validate',
          'test terminology services': 'validate',
          'publish terminology updates': 'custom'
        }
      },
      L3SOP8: {
        id: 'L3SOP8',
        name: 'Implementation and Deployment',
        description: 'Deploy and implement machine-readable specifications',
        stepMappings: {
          'prepare deployment packages': 'custom',
          'configure FHIR servers': 'custom',
          'deploy implementation guides': 'custom',
          'test system integration': 'validate',
          'validate production deployment': 'validate',
          'monitor system performance': 'poll'
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
          'the composition should conform to (.*)': 'validate',
          'archetype validation succeeds': 'validate'
        }
      },
      GO2: {
        id: 'GO2',
        name: 'Composition Creation',
        description: 'Create openEHR compositions',
        stepMappings: {
          'create composition (.*)': 'waitForUpload',
          'submit composition': 'waitForUpload',
          'the composition is processed': 'custom'
        }
      }
    }
  }
];

export const exampleScenarios: ExampleScenario[] = [
  // FHIR Examples
  {
    id: 'validate-patient',
    name: 'Validate Patient',
    description: 'Basic FHIR Patient resource validation',
    dataModel: 'fhir',
    content: `Feature: Client submits and monitor validates an allergy
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
    And the monitor marks the submission as "Pass"`
  },
  {
    id: 'create-observation',
    name: 'Create Observation',
    description: 'Create and validate FHIR Observation',
    dataModel: 'fhir',
    content: `Feature: Observation Resource Creation

Scenario: Create a vital signs observation
    Given the user submits an Observation resource
    When the resource is processed
    Then validate against http://hl7.org/fhir/StructureDefinition/Observation
    And poll for processing status
    And inform the user "Observation created successfully"`
  },

  // SMART Guidelines Examples
  {
    id: 'smart-anc-workflow',
    name: 'SMART ANC Workflow',
    description: 'Antenatal Care workflow following SMART Guidelines',
    dataModel: 'smart-guidelines',
    content: `Feature: SMART Guidelines ANC Workflow

Scenario: Execute antenatal care workflow
    Given collect patient data for antenatal care
    When apply clinical guidelines for ANC
    Then execute clinical decision support
    And provide clinical recommendations
    And create care plan for pregnant patient
    And calculate quality indicators for ANC program`
  },
  {
    id: 'smart-immunization',
    name: 'SMART Immunization',
    description: 'Immunization workflow with SMART Guidelines',
    dataModel: 'smart-guidelines',
    content: `Feature: SMART Guidelines Immunization

Scenario: Process immunization according to SMART Guidelines
    Given collect patient immunization history
    When validate data quality for immunization records  
    Then execute clinical decision support for vaccines
    And trigger clinical alerts if vaccines overdue
    And update care pathway for immunization schedule
    And monitor health outcomes for vaccination program`
  },

  // SMART L2 SOP Examples
  {
    id: 'l2-sop-requirements',
    name: 'L2 SOP Health Program Requirements',
    description: 'Follow L2 SOP for health program requirements analysis',
    dataModel: 'smart-l2-sop',
    content: `Feature: L2 SOP Health Program Requirements Analysis

Scenario: Analyze health program requirements following L2 SOP
    Given analyze health program objectives for maternal health
    When document clinical workflows for antenatal care
    And identify key health indicators for pregnancy outcomes
    Then define care pathways for high-risk pregnancies
    And establish program governance structure
    And validate program requirements completeness`
  },
  {
    id: 'l2-sop-clinical-decisions',
    name: 'L2 SOP Clinical Decision Support',
    description: 'Follow L2 SOP for clinical decision support requirements',
    dataModel: 'smart-l2-sop',
    content: `Feature: L2 SOP Clinical Decision Support Requirements

Scenario: Define clinical decision support requirements following L2 SOP
    Given identify clinical decision points in immunization workflow
    When document clinical algorithms for vaccine recommendations
    And define alert conditions for overdue vaccinations
    Then specify recommendation logic for contraindications
    And establish clinical thresholds for age-based vaccines
    And validate clinical rules against evidence base`
  },

  // SMART L3 SOP Examples
  {
    id: 'l3-sop-fhir-ig',
    name: 'L3 SOP FHIR Implementation Guide',
    description: 'Follow L3 SOP for FHIR IG development',
    dataModel: 'smart-l3-sop',
    content: `Feature: L3 SOP FHIR Implementation Guide Development

Scenario: Develop FHIR Implementation Guide following L3 SOP
    Given create FHIR profiles for Patient and Immunization resources
    When define value sets for vaccine codes and administration sites
    And specify code systems for immunization status
    Then create capability statements for immunization registry
    And validate FHIR resources against profiles
    And publish implementation guide to registry`
  },
  {
    id: 'l3-sop-cql',
    name: 'L3 SOP CQL Development',
    description: 'Follow L3 SOP for Clinical Quality Language development',
    dataModel: 'smart-l3-sop',
    content: `Feature: L3 SOP Clinical Quality Language Development

Scenario: Develop executable clinical logic using CQL following L3 SOP
    Given author CQL libraries for immunization recommendations
    When define clinical expressions for vaccine eligibility
    And implement decision logic for contraindications
    Then create quality measures for vaccination coverage
    And test CQL execution against test patients
    And validate clinical algorithms with subject matter experts`
  },
  {
    id: 'l3-sop-questionnaire',
    name: 'L3 SOP FHIR Questionnaire',
    description: 'Follow L3 SOP for FHIR Questionnaire development',
    dataModel: 'smart-l3-sop',
    content: `Feature: L3 SOP FHIR Questionnaire Development

Scenario: Create structured data collection forms following L3 SOP
    Given design questionnaire structure for patient registration
    When define question items for demographic information
    And specify answer options for gender and ethnicity
    Then implement conditional logic for pregnancy status
    And validate questionnaire against FHIR specification
    And test form functionality in reference implementation`
  },

  // EIRA Examples
  {
    id: 'eira-interoperability',
    name: 'EIRA Interoperability',
    description: 'Test interoperability layers according to EIRA',
    dataModel: 'EIRA',
    content: `Feature: EIRA Interoperability Assessment

Scenario: Validate all EIRA interoperability layers
    Given check legal compliance for health data exchange
    When align business processes between organizations
    And validate semantic meaning of health data
    Then establish technical connection
    And test system integration
    And ensure GDPR compliance`
  },

  // KMEHR Examples
  {
    id: 'kmehr-prescription',
    name: 'KMEHR Prescription',
    description: 'Process KMEHR prescription message',
    dataModel: 'kmehr',
    content: `Feature: KMEHR Prescription Processing

Scenario: Process electronic prescription
    Given the user submits a KMEHR prescription
    When the KMEHR is processed
    Then validate KMEHR message
    And process KMEHR transaction
    And inform the user "Prescription processed"`
  },

  // openEHR Examples
  {
    id: 'openehr-composition',
    name: 'openEHR Composition',
    description: 'Validate openEHR composition',
    dataModel: 'openehr',
    content: `Feature: openEHR Composition Validation

Scenario: Validate clinical composition
    Given the user creates a clinical composition
    When the composition is processed
    Then validate against archetype openEHR-EHR-COMPOSITION.encounter.v1
    And the composition should be valid
    And inform the user "Composition validated successfully"`
  }
];