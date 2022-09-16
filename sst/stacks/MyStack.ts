import { StackContext, Table, AppSyncApi, Function, Bucket } from "@serverless-stack/resources";
import { MappingTemplate, AppsyncFunction, ResolverProps } from "@aws-cdk/aws-appsync-alpha";
import * as lambda from "aws-cdk-lib/aws-lambda";

export function MyStack({ stack }: StackContext) {

  ////////////////////////////////////
  //  DYNAMODB
  ////////////////////////////////////
  // Create a notes table
  const SkillProfileTable = new Table(stack, "SkillProfile", {
    cdk:{
      table:{
        tableName: "SkillProfile",
  
      },
    },
    fields: {
      ProfileID: "string",
      ID: "string",
    },
    primaryIndex: { partitionKey: "ProfileID", sortKey: "ID" },
    globalIndexes: {
      IDIndex: { partitionKey: "ID"},
    },
  });

  ////////////////////////////////////
  //  LAMBDA
  ////////////////////////////////////

  const Openpyxl=new lambda.LayerVersion(stack, "MyLayer", {
    code: lambda.Code.fromAsset("../Lambda/my-lambda-layer/aws-layer/lambda-layer.zip"),
    compatibleRuntimes: [lambda.Runtime.PYTHON_3_8, lambda.Runtime.NODEJS_16_X ] 
  });

  const myLambda = new Function(stack,"my Function",{
    runtime: "python3.8",
    srcPath: "../Lambda",
    handler: "XLSM2JSON.lambda_handler",
    timeout: "180 seconds",
    layers:[Openpyxl],
    permissions:["dynamodb"]
  })

  ////////////////////////////////////
  //  S3
  ////////////////////////////////////
  const bucket = new Bucket(stack, 'MyFirstBucket',{
    name: 'skillprofilebucket',
    notifications:{
      myNotification:{
        filters: [{suffix:".xlsm"}],
        events: ["object_created_put"],
        function: myLambda
      }
    }
  });

  bucket.attachPermissions(["s3"]);

  ////////////////////////////////////
  //  APPSYNC
  ////////////////////////////////////
  // Create the AppSync GraphQL API
  const api = new AppSyncApi(stack, "AppSyncApi", {
    schema: "../AppSync/schema.graphql",
    dataSources: {
      tableDS: {
        type: "dynamodb",
        table: SkillProfileTable
      },
    },
    resolvers: {
      "Query getProfile": {
        dataSource: "tableDS",
        requestMapping: { file: "../AppSync/DynamoDBResolvers/GetProfile/request.vm" },
        responseMapping: { file: "../AppSync/DynamoDBResolvers/GetProfile/response.vm" },
      },
      "Query listProfiles": {
        dataSource: "tableDS",
        requestMapping: { file: "../AppSync/DynamoDBResolvers/ListProfiles/request.vm" },
        responseMapping: { file: "../AppSync/DynamoDBResolvers/ListProfiles/response.vm" },
      }
    },
  });

  const getProfileWithSkill = new AppsyncFunction(stack, 'function1', {
    name: 'getProfileWithSkill',
    api:api.cdk.graphqlApi,
    dataSource: api.getDataSource("tableDS")!,
    requestMappingTemplate: MappingTemplate.fromFile('../AppSync/DynamoDBResolvers/GetSkill/Functions/getProfileWithSkill/request.vm'),
    responseMappingTemplate: MappingTemplate.fromFile('../AppSync/DynamoDBResolvers/GetSkill/Functions/getProfileWithSkill/response.vm'),
  });

  const getBatchProfiles = new AppsyncFunction(stack, 'function2', {
    name: 'getBatchProfiles',
    api:api.cdk.graphqlApi,
    dataSource: api.getDataSource("tableDS")!,
    requestMappingTemplate: MappingTemplate.fromFile('../AppSync/DynamoDBResolvers/GetSkill/Functions/getBatchProfiles/request.vm'),
    responseMappingTemplate: MappingTemplate.fromFile('../AppSync/DynamoDBResolvers/GetSkill/Functions/getBatchProfiles/response.vm'),
  });

  api.addResolvers(stack,{
    "Query getSkill": {
      dataSource: "none",
      cdk: {
        resolver: {
          requestMappingTemplate: MappingTemplate.fromString("{}"),   //If not: "ERROR: Request mapping template not specified."
          pipelineConfig: [getProfileWithSkill,getBatchProfiles],
          responseMappingTemplate: MappingTemplate.fromFile('../AppSync/DynamoDBResolvers/GetSkill/afterMappingTemplate.vm'),
        },
      },
    }
  })

  // Enable the AppSync API to access the DynamoDB table
  api.attachPermissions([SkillProfileTable]);

  // Show the AppSync API Id in the output
  stack.addOutputs({
    ApiId: api.apiId,
    ApiKey: api.cdk.graphqlApi.apiKey!,
    APiUrl: api.url,
  });
}
