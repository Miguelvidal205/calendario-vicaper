export interface DomainEvent<
  TType extends string = string,
  TPayload = unknown,
> {
  id: string; // uuid
  type: TType;
  terrenoId: string;
  occurredAt: Date;
  payload: TPayload;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}
