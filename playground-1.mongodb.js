// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('data-fair')

// Create a new document in the collection.
db.getCollection('settings').insertOne({
  webhooks: [],
  apiKeys: [
    {
      title: 'clé',
      scopes: [
        'datasets'
      ],
      adminMode: true,
      asAccount: true,
      id: 'tfTXaUWAw5K600jMPeNYg',
      key: 'e21a3e4ae78aef103f4e13e43cddc653a681d3437e72990cc2f3d6d6a218c93566343681a42876ba3d51215f6e9dc834c0e2b8c6a5f6335f9696782fbc45cc19'
    }
  ],
  licenses: [],
  name: 'Super Admin',
  publicationSites: [],
  type: 'user',
  id: 'superadmin'
})
