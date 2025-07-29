// Dynamic imports for ESM modules
export async function importOpenAIAgents() {
  return await import('@openai/agents-core');
}

export async function importOpenAIAgentsPackage() {
  return await import('@openai/agents');
}