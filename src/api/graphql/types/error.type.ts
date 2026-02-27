import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GraphQLError {
  @Field()
  message!: string;

  @Field({ nullable: true })
  code?: string;

  @Field(() => [String], { nullable: true })
  path?: string[];

  @Field({ nullable: true })
  timestamp?: string;
}
