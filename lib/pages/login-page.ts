import type { Locator, Page } from '@playwright/test';

// Plane's sign-in form is two-step: submit the email first, the password
// field appears after. Shared by the auth setup (storage states) and the
// auth UI tests.
export class LoginPage {
  readonly email: Locator;
  readonly continueButton: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;

  constructor(private page: Page) {
    this.email = page.getByPlaceholder('name@company.com');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.password = page.getByPlaceholder('Enter password');
    this.submitButton = page.getByRole('button', { name: 'Go to workspace' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async signIn(email: string, password: string) {
    await this.goto();
    await this.email.fill(email);
    await this.continueButton.click();
    await this.password.fill(password);
    await this.submitButton.click();
  }
}
