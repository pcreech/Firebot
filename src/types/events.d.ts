export type EventSource = {
    id: string;
    name: string;
    events: Array<{
        id: string;
        name: string;
        description: string;
        cached?: boolean;
        manualMetadata?: Record<string, unknown>;
    }>;
};

export type EventFilter = {
    id: string;
    name: string;
    description: string;
    events: Array<{
        eventSourceId: string;
        eventId: string;
    }>;
    comparisonTypes: string[];
    valueType: "text" | "preset";
    presetValues(...args: unknown[]): Promise<unknown[]>;
    predicate(
        filterSettings: { comparisonType: string; value: unknown },
        eventData: {
            eventSourceId: string;
            eventId: string;
            eventMeta: Record<string, unknown>;
        }
    ): Promise<boolean>;
};