import { Suspense } from 'react';
import { SetupScreen } from './setup-screen';

export const metadata = { title: 'Set up your staff account' };

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupScreen />
    </Suspense>
  );
}
