// @profileaxis/ai-contracts/dto/error-envelope — AI error envelope (M1 frozen)

export interface AIErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
  timestamp: string;
}

export function createErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): AIErrorEnvelope {
  const envelope: AIErrorEnvelope = {
    error: { code, message },
    requestId,
    timestamp: new Date().toISOString(),
  };
  if (details) {
    envelope.error.details = details;
  }
  return envelope;
}
