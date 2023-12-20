export type TriggerType =
    | "command"
    | "custom_script"
    | "startup_script"
    | "api"
    | "event"
    | "hotkey"
    | "timer"
    | "counter"
    | "preset"
    | "quick_action"
    | "manual";

export type Trigger = {
    type: TriggerType;
    metadata: {
        username: string;
        hotkey?: unknown;
        command?: unknown;
        userCommand?: { trigger: string; args: string[] };
        chatMessage?: unknown;
        event?: { id: string; name: string };
        eventSource?: { id: string; name: string };
        eventData?: Record<string, unknown>;
        [x: string]: unknown;
    };
};

export type TriggersObject = {
    [T in TriggerType]?: T extends "event" ? string[] | boolean : boolean;
};