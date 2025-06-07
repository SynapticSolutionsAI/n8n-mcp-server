/**
 * Environment Configuration
 * 
 * This module handles loading and validating environment variables
 * required for connecting to the n8n API.
 */

import dotenv from 'dotenv';
import findConfig from 'find-config';
import path from 'path';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode } from '../errors/error-codes.js';
import { N8nApiConfig } from '../types/index.js';

// Environment variable names
export const ENV_VARS = {
  N8N_API_URL: 'N8N_API_URL',
  N8N_API_KEY: 'N8N_API_KEY',
  N8N_WEBHOOK_USERNAME: 'N8N_WEBHOOK_USERNAME',
  N8N_WEBHOOK_PASSWORD: 'N8N_WEBHOOK_PASSWORD',
  DEBUG: 'DEBUG',
};

/**
 * Load environment variables from .env file if present
 */
export function loadEnvironmentVariables(): void {
  const {
    N8N_API_URL,
    N8N_API_KEY,
    N8N_WEBHOOK_USERNAME,
    N8N_WEBHOOK_PASSWORD
  } = process.env;

  if (
    !N8N_API_URL &&
    !N8N_API_KEY &&
    !N8N_WEBHOOK_USERNAME &&
    !N8N_WEBHOOK_PASSWORD
  ) {
    const projectRoot = findConfig('package.json');
    if (projectRoot) {
      const envPath = path.resolve(path.dirname(projectRoot), '.env');
      dotenv.config({ path: envPath });
    }
  }
}

/**
 * Validate and retrieve required environment variables
 * 
 * @returns Validated environment configuration
 * @throws {McpError} If required environment variables are missing
 */
export function getEnvConfig(): N8nApiConfig {
  const n8nApiUrl = process.env[ENV_VARS.N8N_API_URL];
  const n8nApiKey = process.env[ENV_VARS.N8N_API_KEY];
  const n8nWebhookUsername = process.env[ENV_VARS.N8N_WEBHOOK_USERNAME];
  const n8nWebhookPassword = process.env[ENV_VARS.N8N_WEBHOOK_PASSWORD];
  const debug = process.env[ENV_VARS.DEBUG]?.toLowerCase() === 'true';

  return {
    n8nApiUrl,
    n8nApiKey,
    n8nWebhookUsername,
    n8nWebhookPassword,
    debug,
  };
}
