import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

// Configure Amplify with the generated outputs
export const configureAmplify = () => {
  Amplify.configure(outputs);
};

