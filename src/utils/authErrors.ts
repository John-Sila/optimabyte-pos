// utils/authErrors.ts
export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-not-found":
      return "No account found with this email.";

    case "auth/wrong-password":
      return "Incorrect password. Please try again.";

    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    case "auth/invalid-credential":
      return "Invalid login credentials.";

    default:
      return "Unable to sign in. Please try again.";
  }
}