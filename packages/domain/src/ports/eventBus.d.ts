export interface DomainEvent<TType extends string = string, TPayload = unknown> {
    id: string;
    type: TType;
    terrenoId: string;
    occurredAt: Date;
    payload: TPayload;
}
export interface EventBus {
    publish(event: DomainEvent): Promise<void>;
}
//# sourceMappingURL=eventBus.d.ts.map