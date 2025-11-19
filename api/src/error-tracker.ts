import type { BunRequest } from "bun";

const HOURS_TO_TRACK = 12;
const HOUR_IN_MS = 60 * 60 * 1000;

type ApiCountMap = Map<string, number>;
type StatusMap = Map<number, ApiCountMap>;

const errorBuckets: Map<number, StatusMap> = new Map();

function getHourBucketKey(date: Date): number {
    const truncated = new Date(date);
    truncated.setMinutes(0, 0, 0);
    return truncated.getTime();
}

function pruneBuckets(now: Date): void {
    const cutoff = now.getTime() - HOURS_TO_TRACK * HOUR_IN_MS;
    for (const key of errorBuckets.keys()) {
        if (key < cutoff) {
            errorBuckets.delete(key);
        }
    }
}

export function recordApiError(apiName: string, statusCode: number, date: Date = new Date()): void {
    pruneBuckets(date);
    const bucketKey = getHourBucketKey(date);
    let statusMap = errorBuckets.get(bucketKey);
    if (!statusMap) {
        statusMap = new Map();
        errorBuckets.set(bucketKey, statusMap);
    }

    const normalizedStatus = Number.isFinite(statusCode) ? Math.trunc(statusCode) : 500;
    let apiMap = statusMap.get(normalizedStatus);
    if (!apiMap) {
        apiMap = new Map();
        statusMap.set(normalizedStatus, apiMap);
    }

    apiMap.set(apiName, (apiMap.get(apiName) || 0) + 1);
}

export interface ErrorBucket {
    hourStart: string;
    errors: Record<string, Record<string, number>>;
}

export interface ErrorMetricsResponse {
    buckets: ErrorBucket[];
}

export function getErrorMetrics(): ErrorMetricsResponse {
    const now = new Date();
    pruneBuckets(now);
    const buckets: ErrorBucket[] = [];

    for (let i = HOURS_TO_TRACK - 1; i >= 0; i--) {
        const bucketDate = new Date(now.getTime() - i * HOUR_IN_MS);
        const bucketKey = getHourBucketKey(bucketDate);
        const statusMap = errorBuckets.get(bucketKey);
        const errors: Record<string, Record<string, number>> = {};

        if (statusMap) {
            for (const [statusCode, apiMap] of statusMap.entries()) {
                const statusKey = statusCode.toString();
                errors[statusKey] = {};
                for (const [apiName, count] of apiMap.entries()) {
                    errors[statusKey][apiName] = count;
                }
            }
        }

        buckets.push({
            hourStart: new Date(bucketKey).toISOString(),
            errors,
        });
    }

    return { buckets };
}

type RouteHandler = (req: BunRequest) => Response | Promise<Response>;

export function withErrorTracking(apiName: string, handler: RouteHandler): RouteHandler {
    return async (req: BunRequest): Promise<Response> => {
        try {
            const response = await handler(req);
            if (response.status >= 400) {
                recordApiError(apiName, response.status);
            }
            return response;
        } catch (error) {
            recordApiError(apiName, 500);
            throw error;
        }
    };
}

