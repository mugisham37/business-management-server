import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ServiceHealth {
  @Field()
  status!: string;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class HealthCheckResponse {
  @Field()
  status!: string;

  @Field(() => ServiceHealth)
  database!: ServiceHealth;

  @Field(() => ServiceHealth)
  cache!: ServiceHealth;

  @Field(() => ServiceHealth)
  queue!: ServiceHealth;

  @Field()
  timestamp!: string;
}
