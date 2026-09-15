import { Analytics } from '@vercel/analytics/react';
import { RouterProvider } from 'react-router';
import { Providers } from './providers';
import { router } from './router';

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <Analytics />
    </Providers>
  );
}
