import { config, collection, fields, singleton } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  ui: {
    brand: { name: 'Deneb4' },
  },
  collections: {
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
