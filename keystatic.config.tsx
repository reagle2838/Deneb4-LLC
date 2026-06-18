import { config, collection, fields, singleton } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  ui: {
    brand: { name: 'Deneb4' },
    navigation: {
      'Content Management': ['articles', 'work', 'services', 'privacyPolicy', 'termsOfService'],
    },
  },
  collections: {
    work: collection({
      label: 'Work (Case Studies)',
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
        coverImage: fields.image({
          label: 'Cover Image',
          directory: 'public/images/work',
          publicPath: '/images/work',
          description: 'Main image shown on the Work card and at the top of the case study.',
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
        body: fields.document({
          label: 'Case Study Body',
          description: 'Paste from Google Docs or Word and it keeps your formatting. Use the toolbar for headings, bold, lists, and links.',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'public/images/work',
            publicPath: '/images/work',
          },
        }),
        gallery: fields.array(
          fields.object({
            image: fields.image({
              label: 'Image',
              directory: 'public/images/work',
              publicPath: '/images/work',
            }),
            caption: fields.text({ label: 'Caption (optional)' }),
          }),
          {
            label: 'Image Gallery',
            itemLabel: (props) => props.fields.caption.value || 'Image',
          }
        ),
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
        coverImage: fields.image({
          label: 'Cover Image',
          directory: 'public/images/articles',
          publicPath: '/images/articles',
          description: 'Shown on the article card and at the top of the article.',
        }),
        body: fields.document({
          label: 'Body',
          description: 'Paste from Google Docs or Word and it keeps your formatting. Use the toolbar for headings, bold, lists, and links.',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'public/images/articles',
            publicPath: '/images/articles',
          },
        }),
      },
    }),
  },
  singletons: {
    services: singleton({
      label: 'Services (What I Offer)',
      path: 'content/pages/services',
      schema: {
        groups: fields.array(
          fields.object({
            id: fields.text({
              label: 'ID (anchor / image key)',
              description: 'Keep stable: content-systems, sales-ops, or collateral. Used for links and the mega-menu image.',
            }),
            title: fields.text({ label: 'Title', validation: { isRequired: true } }),
            tagline: fields.text({ label: 'Tagline', multiline: true }),
            items: fields.array(fields.text({ label: 'Item' }), {
              label: 'Items',
              itemLabel: (props) => props.value || 'Item',
            }),
          }),
          {
            label: 'Capability Groups',
            itemLabel: (props) => props.fields.title.value || 'Group',
          }
        ),
      },
    }),
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
