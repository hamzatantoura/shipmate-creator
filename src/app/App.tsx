import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";

/**
 * Root application component. Composes providers around the router.
 * All feature wiring happens in @/app/router.tsx.
 */
const App = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);

export default App;