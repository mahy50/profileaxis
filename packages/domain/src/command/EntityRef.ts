// EntityRef — typed reference to a domain entity (M1 frozen)

export interface EntityRef {
  entityType: 'structural' | 'joint' | 'module';
  id: string;
  semanticPath: string;
}
