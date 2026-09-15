/** Auth feature: the surface other parts of the app may import. Everything else is private. */
export { AuthDialog } from './components/AuthDialog';
export { RequireAuth } from './components/RequireAuth';
export {
  useDeleteAccount,
  useHandleAvailability,
  useLogout,
  useSession,
  useUpdateProfile,
} from './queries';
