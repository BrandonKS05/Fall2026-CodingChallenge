/** Auth feature: the surface other parts of the app may import. Everything else is private. */
export { AuthDialog } from './components/AuthDialog';
export { RequireAuth } from './components/RequireAuth';
export {
  useChangePassword,
  useDeleteAccount,
  useHandleAvailability,
  useLogout,
  useRevokeSessions,
  useSession,
  useUpdateProfile,
} from './queries';
