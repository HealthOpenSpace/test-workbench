import { ParsedScenario, XMLOutput, Scriptlet } from '../../types';
import { GherkinParser } from './gherkinParser';

export class XMLGenerator {
  private parser: GherkinParser;

  constructor(parser: GherkinParser) {
    this.parser = parser;
  }

  generate(parsedScenario: ParsedScenario): XMLOutput {
    const { scenario, dataModel } = parsedScenario;
    const scriptlets: Scriptlet[] = [];
    
    // Generate scriptlets from steps
    let scriptletIndex = 1;
    const scriptletXml: string[] = [];

    for (const step of scenario.steps) {
      const mapping = this.parser.getStepMapping(step.text);
      const parameters = this.parser.extractParameters(step.text);
      
      if (mapping) {
        const scriptlet: Scriptlet = {
          id: `scriptlet_${scriptletIndex}`,
          name: step.text,
          type: mapping as Scriptlet['type'],
          parameters
        };
        
        scriptlets.push(scriptlet);
        scriptletXml.push(this.generateScriptletXml(scriptlet, step.text));
        scriptletIndex++;
      } else {
        // Generate a custom scriptlet for unmapped steps
        const scriptlet: Scriptlet = {
          id: `scriptlet_${scriptletIndex}`,
          name: step.text,
          type: 'custom',
          parameters: { action: step.text }
        };
        
        scriptlets.push(scriptlet);
        scriptletXml.push(this.generateScriptletXml(scriptlet, step.text));
        scriptletIndex++;
      }
    }

    const testcaseName = scenario.name || 'Untitled Test Case';
    
    const xml = this.buildTestCaseXml(testcaseName, scriptletXml, dataModel.name);

    return {
      xml,
      testcaseName,
      scriptlets
    };
  }

  private generateScriptletXml(scriptlet: Scriptlet, originalText: string): string {
    switch (scriptlet.type) {
      case 'validate':
        return this.generateValidateScriptlet(scriptlet, originalText);
      case 'informUser':
        return this.generateInformUserScriptlet(scriptlet);
      case 'poll':
        return this.generatePollScriptlet(scriptlet);
      case 'waitForUpload':
        return this.generateWaitForUploadScriptlet(scriptlet);
      default:
        return this.generateCustomScriptlet(scriptlet, originalText);
    }
  }

  private generateValidateScriptlet(scriptlet: Scriptlet, originalText: string): string {
    const url = scriptlet.parameters.url || '';
    const resourceType = scriptlet.parameters.resourceType || 'Resource';
    
    return `    <scriptlet id="${scriptlet.id}">
      <n>Validate ${resourceType}</n>
      <description>${this.escapeXml(originalText)}</description>
      <steps>
        <validate>
          <input name="resource">$input</input>
          <input name="profile">${url}</input>
          <output name="report">$validationReport</output>
        </validate>
      </steps>
    </scriptlet>`;
  }

  private generateInformUserScriptlet(scriptlet: Scriptlet): string {
    const message = scriptlet.parameters.message || 'Operation completed';
    
    return `    <scriptlet id="${scriptlet.id}">
      <n>Inform User</n>
      <description>Display information to user</description>
      <steps>
        <informUser>
          <input name="message">${this.escapeXml(message)}</input>
        </informUser>
      </steps>
    </scriptlet>`;
  }

  private generatePollScriptlet(scriptlet: Scriptlet): string {
    return `    <scriptlet id="${scriptlet.id}">
      <n>Poll for Status</n>
      <description>Poll for response or status update</description>
      <steps>
        <poll>
          <input name="endpoint">$statusEndpoint</input>
          <input name="timeout">30000</input>
          <input name="interval">1000</input>
          <output name="response">$pollResponse</output>
        </poll>
      </steps>
    </scriptlet>`;
  }

  private generateWaitForUploadScriptlet(scriptlet: Scriptlet): string {
    const resourceType = scriptlet.parameters.resourceType || 'Resource';
    
    return `    <scriptlet id="${scriptlet.id}">
      <n>Wait for ${resourceType} Upload</n>
      <description>Wait for user to upload ${resourceType} resource</description>
      <steps>
        <waitForUpload>
          <input name="resourceType">${resourceType}</input>
          <input name="acceptedFormats">application/fhir+json,application/fhir+xml</input>
          <output name="resource">$uploadedResource</output>
        </waitForUpload>
      </steps>
    </scriptlet>`;
  }

  private generateCustomScriptlet(scriptlet: Scriptlet, originalText: string): string {
    return `    <scriptlet id="${scriptlet.id}">
      <n>Custom Action</n>
      <description>${this.escapeXml(originalText)}</description>
      <steps>
        <custom>
          <input name="action">${this.escapeXml(originalText)}</input>
        </custom>
      </steps>
    </scriptlet>`;
  }

  private buildTestCaseXml(testcaseName: string, scriptletXml: string[], dataModel: string): string {
    const timestamp = new Date().toISOString();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testcase xmlns="http://www.gitb.com/tdl/v1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <n>${this.escapeXml(testcaseName)}</n>
    <description>Generated from Gherkin scenario for ${dataModel}</description>
    <version>1.0</version>
    <generated>${timestamp}</generated>
    <dataModel>${dataModel}</dataModel>
  </metadata>
  
  <actors>
    <actor id="User" name="Test User" role="SUT"/>
    <actor id="System" name="Validation System" role="SIMULATED"/>
  </actors>
  
  <variables>
    <var name="input" type="object"/>
    <var name="validationReport" type="object"/>
    <var name="statusEndpoint" type="string"/>
    <var name="pollResponse" type="object"/>
    <var name="uploadedResource" type="object"/>
  </variables>
  
  <scriptlets>
${scriptletXml.join('\n\n')}
  </scriptlets>
  
  <steps>
    <sequence>
${scriptletXml.map((_, index) => `      <call id="step_${index + 1}" path="scriptlet_${index + 1}"/>`).join('\n')}
    </sequence>
  </steps>
</testcase>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}