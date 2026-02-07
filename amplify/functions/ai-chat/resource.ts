import { defineFunction } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';
import { SecurityGroup, Subnet, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const aiChat = defineFunction((scope) => {
  const vpcId = process.env.AMPLIFY_VPC_ID;
  const subnetIds = process.env.AMPLIFY_PRIVATE_SUBNET_IDS?.split(',').map((id) => id.trim()).filter(Boolean);
  const azs = process.env.AMPLIFY_VPC_AZS?.split(',').map((az) => az.trim()).filter(Boolean);
  const lambdaSgId = process.env.AMPLIFY_LAMBDA_SG_ID;

  if (!vpcId || !subnetIds?.length || !azs?.length || !lambdaSgId) {
    throw new Error(
      'AMPLIFY_VPC_ID, AMPLIFY_PRIVATE_SUBNET_IDS, AMPLIFY_VPC_AZS, and AMPLIFY_LAMBDA_SG_ID are required for VPC deploy.'
    );
  }

  const vpc = Vpc.fromVpcAttributes(scope, 'AiChatVpc', {
    vpcId,
    availabilityZones: azs,
    privateSubnetIds: subnetIds,
  });

  const lambdaSecurityGroup = SecurityGroup.fromSecurityGroupId(scope, 'AiChatLambdaSg', lambdaSgId);

  return new NodejsFunction(scope, 'AiChatHandler', {
    entry: join(__dirname, 'handler.ts'),
    runtime: Runtime.NODEJS_18_X,
    timeout: Duration.seconds(30),
    memorySize: 1024,
    vpc,
    vpcSubnets: { subnets: subnetIds.map((id, index) => Subnet.fromSubnetId(scope, `AiChatSubnet${index}`, id)) },
    securityGroups: [lambdaSecurityGroup],
  });
});
