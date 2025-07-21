import { 
  GherkinScenario, 
  GherkinStep, 
  ParsedScenario, 
  ParseError, 
  DataModel 
} from '../types';

export class GherkinParser {
  private dataModel: DataModel;

  constructor(dataModel: DataModel) {
    this.dataModel = dataModel;
  }

  parse(content: string): ParsedScenario {
    const lines = content.split('\n');
    const errors: ParseError[] = [];
    const warnings: string[] = [];
    const scenarios: GherkinScenario[] = [];

    let currentScenario: Partial<GherkinScenario> | null = null;
    let inScenario = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      if (line.startsWith('Feature:')) {
        continue; // Skip feature lines
      }

      if (line.startsWith('@')) {
        // Handle tags
        if (currentScenario) {
          currentScenario.tags = [...(currentScenario.tags || []), ...this.parseTags(line)];
        }
        continue;
      }

      if (line.startsWith('Scenario:')) {
        // Save previous scenario
        if (currentScenario && currentScenario.name) {
          scenarios.push(currentScenario as GherkinScenario);
        }

        // Start new scenario
        currentScenario = {
          name: line.replace('Scenario:', '').trim(),
          steps: [],
          tags: []
        };
        inScenario = true;
        continue;
      }

      if (inScenario && currentScenario && this.isStep(line)) {
        const step = this.parseStep(line, lineNumber);
        if (step) {
          currentScenario.steps = [...(currentScenario.steps || []), step];
          
          // Validate step against data model
          const stepErrors = this.validateStep(step, lineNumber);
          errors.push(...stepErrors);
        }
      } else if (line && !line.startsWith('#') && inScenario) {
        // Non-empty line that's not a comment and we're in a scenario
        errors.push({
          line: lineNumber,
          column: 1,
          message: `Unexpected content: "${line}"`,
          severity: 'warning'
        });
      }
    }

    // Save final scenario
    if (currentScenario && currentScenario.name) {
      scenarios.push(currentScenario as GherkinScenario);
    }

    // For simplicity, return the first scenario
    const scenario = scenarios[0] || { name: 'Untitled', steps: [] };

    return {
      scenario,
      dataModel: this.dataModel,
      errors,
      warnings
    };
  }

  private parseTags(line: string): string[] {
    return line.split('@').filter(tag => tag.trim()).map(tag => tag.trim());
  }

  private isStep(line: string): boolean {
    return /^(Given|When|Then|And|But)\s/.test(line);
  }

  private parseStep(line: string, lineNumber: number): GherkinStep | null {
    const match = line.match(/^(Given|When|Then|And|But)\s+(.+)$/);
    if (!match) {
      return null;
    }

    return {
      type: match[1] as GherkinStep['type'],
      text: match[2],
      line: lineNumber
    };
  }

  private validateStep(step: GherkinStep, lineNumber: number): ParseError[] {
    const errors: ParseError[] = [];

    // Check if step matches any extension patterns
    let matched = false;
    
    for (const extension of Object.values(this.dataModel.extensions)) {
      for (const pattern of Object.keys(extension.stepMappings)) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(step.text)) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      errors.push({
        line: lineNumber,
        column: 1,
        message: `Step "${step.text}" does not match any known patterns for ${this.dataModel.name}`,
        severity: 'warning'
      });
    }

    return errors;
  }

  public getStepMapping(stepText: string): string | null {
    for (const extension of Object.values(this.dataModel.extensions)) {
      for (const [pattern, mapping] of Object.entries(extension.stepMappings)) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(stepText)) {
          return mapping;
        }
      }
    }
    return null;
  }

  public extractParameters(stepText: string): Record<string, string> {
    const params: Record<string, string> = {};
    
    // Extract URLs
    const urlMatch = stepText.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      params.url = urlMatch[1];
    }

    // Extract resource types
    const resourceMatch = stepText.match(/\b(Patient|Observation|Practitioner|Organization|Encounter)\b/i);
    if (resourceMatch) {
      params.resourceType = resourceMatch[1];
    }

    // Extract quoted strings
    const quotedMatch = stepText.match(/"([^"]*)"/);
    if (quotedMatch) {
      params.message = quotedMatch[1];
    }

    return params;
  }
}