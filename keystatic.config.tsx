import { config, collection, fields, singleton } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  ui: {
    brand: { name: 'Deneb4' },
  },
  collections: {
    clients: collection({
      label: 'Clients',
      slugField: 'name',
      path: 'content/clients/*',
      schema: {
        name: fields.slug({ name: { label: 'Client Name' } }),
        email: fields.text({ label: 'Email', validation: { isRequired: true } }),
        projectName: fields.text({ label: 'Project Name', description: 'Shown inside the portal' }),
        active: fields.checkbox({ label: 'Active (can log in)', defaultValue: true }),
        passwordHash: fields.text({
          label: 'Password Hash',
          description: 'Auto-managed. Go to /cms-admin to generate a new password for this client.',
        }),
        updates: fields.array(
          fields.object({
            phase: fields.text({ label: 'Phase', description: 'e.g. Phase 1: Discovery' }),
            status: fields.select({
              label: 'Status',
              options: [
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'In Progress', value: 'in-progress' },
                { label: 'Pending Sign-off', value: 'pending-signoff' },
                { label: 'Complete', value: 'complete' },
              ],
              defaultValue: 'upcoming',
            }),
            notes: fields.text({ label: 'Notes', multiline: true }),
            date: fields.date({ label: 'Date' }),
          }),
          { label: 'Project Updates' }
        ),
        files: fields.array(
          fields.object({
            name: fields.text({ label: 'File Name', description: 'e.g. Brand Guidelines v2' }),
            url: fields.text({ label: 'URL', description: 'Google Drive, Dropbox, etc.' }),
            description: fields.text({ label: 'Description' }),
            date: fields.date({ label: 'Date Added' }),
          }),
          { label: 'Shared Files' }
        ),
        revisions: fields.array(
          fields.object({
            phase: fields.text({ label: 'Phase', description: 'e.g. Phase 2: Design' }),
            description: fields.text({ label: 'Description', multiline: true }),
            status: fields.select({
              label: 'Status',
              options: [
                { label: 'Requested', value: 'requested' },
                { label: 'In Progress', value: 'in-progress' },
                { label: 'Complete', value: 'complete' },
              ],
              defaultValue: 'requested',
            }),
            date: fields.date({ label: 'Date' }),
          }),
          { label: 'Feedback & Revisions' }
        ),
        invoices: fields.array(
          fields.object({
            description: fields.text({ label: 'Description', description: 'e.g. Foundation package deposit' }),
            amount: fields.text({ label: 'Amount', description: 'e.g. $2,250' }),
            status: fields.select({
              label: 'Status',
              options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Paid', value: 'paid' },
                { label: 'Overdue', value: 'overdue' },
              ],
              defaultValue: 'pending',
            }),
            dueDate: fields.date({ label: 'Due Date' }),
            invoiceUrl: fields.text({ label: 'Invoice PDF URL (optional)' }),
          }),
          { label: 'Invoices' }
        ),
      },
    }),
    work: collection({
      label: 'Case Studies',
      slugField: 'title',
      path: 'content/work/*',
      schema: {
        title: fields.slug({ name: { label: 'Project Name' } }),
        sector: fields.text({
          label: 'Sector',
          description: 'e.g. Industrial Engineering · Distribution',
        }),
        summary: fields.text({
          label: 'Summary',
          multiline: true,
          description: 'Short description shown on the Work index card.',
        }),
        tags: fields.text({
          label: 'Tags',
          description: 'Comma-separated: Next.js, Mega menu, Catalog',
        }),
        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Live', value: 'live' },
            { label: 'In Progress', value: 'in-progress' },
          ],
          defaultValue: 'live',
        }),
        date: fields.date({ label: 'Completion Date' }),
        liveUrl: fields.text({ label: 'Live Site URL (optional)' }),
        body: fields.text({
          label: 'Case Study Body (Markdown)',
          multiline: true,
          description: 'Full written case study. Use ## headings, - bullets, **bold**.',
        }),
      },
    }),
    articles: collection({
      label: 'Articles & Insights',
      slugField: 'title',
      path: 'content/articles/*',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        subtitle: fields.text({
          label: 'Summary',
          multiline: true,
          validation: { isRequired: true },
        }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Article', value: 'Article' },
            { label: 'Case Study', value: 'Case Study' },
          ],
          defaultValue: 'Article',
        }),
        topic: fields.text({
          label: 'Topic Category',
          description: 'e.g. Strategy, Process, Ownership & Infrastructure, Case Study',
        }),
        date: fields.date({
          label: 'Publish Date',
          validation: { isRequired: true },
        }),
        readTime: fields.text({
          label: 'Read Time',
          description: 'e.g. 6 min read',
        }),
        body: fields.text({
          label: 'Body (Markdown)',
          multiline: true,
          description: 'Write in Markdown. Use ## for headings, - for bullets, **bold**.',
        }),
      },
    }),
  },
  singletons: {
    privacyPolicy: singleton({
      label: 'Privacy Policy',
      path: 'content/pages/privacy-policy',
      schema: {
        body: fields.text({
          label: 'Content (Markdown)',
          multiline: true,
          description: 'Write in Markdown. This appears on /privacy.',
        }),
      },
    }),
    termsOfService: singleton({
      label: 'Terms of Service',
      path: 'content/pages/terms-of-service',
      schema: {
        body: fields.text({
          label: 'Content (Markdown)',
          multiline: true,
          description: 'Write in Markdown. This appears on /terms.',
        }),
      },
    }),
  },
});
