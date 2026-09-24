import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Link, LinkService } from './link.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly linkService = inject(LinkService);

  readonly url = signal('');
  readonly links = signal<Link[]>([]);
  readonly latestLink = signal<Link | null>(null);
  readonly error = signal('');
  readonly isSubmitting = signal(false);

  ngOnInit(): void {
    this.loadLinks();
  }

  submit(): void {
    const value = this.url().trim();
    this.error.set('');
    this.latestLink.set(null);

    if (!this.isHttpUrl(value)) {
      this.error.set('Enter a valid http:// or https:// URL.');
      return;
    }

    this.isSubmitting.set(true);
    this.linkService.create(value).subscribe({
      next: (link) => {
        this.latestLink.set(link);
        this.url.set('');
        this.isSubmitting.set(false);
        this.loadLinks();
      },
      error: (response) => {
        this.error.set(response.error?.error ?? 'The backend could not create that link.');
        this.isSubmitting.set(false);
      },
    });
  }

  private loadLinks(): void {
    this.linkService.list().subscribe({
      next: (links) => this.links.set(links),
      error: () => this.error.set('Could not load links. Is the backend running on port 3000?'),
    });
  }

  private isHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
