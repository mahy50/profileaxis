import { ValidateFunction } from 'ajv';
declare const validateIntentDsl: ValidateFunction;
declare const validateConfirmationDsl: ValidateFunction;
declare const validateDraftDsl: ValidateFunction;
declare const validateResolvedDsl: ValidateFunction;
export interface ValidationResult {
    valid: boolean;
    errors: Array<{
        path: string;
        message: string;
    }>;
}
export declare function validateIntent(data: unknown): ValidationResult;
export declare function validateConfirmation(data: unknown): ValidationResult;
export declare function validateDraft(data: unknown): ValidationResult;
export declare function validateResolved(data: unknown): ValidationResult;
export { validateIntentDsl, validateConfirmationDsl, validateDraftDsl, validateResolvedDsl };
//# sourceMappingURL=validator.d.ts.map