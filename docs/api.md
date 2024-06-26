# API Documentation

## Files/Directories

- [`index.js`](../api/index.js) : Starts the API, gracefully handling shutdowns.
- [`src/app.js`](../api/src/app.js) : Express app configuration, defines the routes.
- [`src/server.js`](../api/src/server.js) : Starts and stops the server (as well as the observer, the mongo connection and the websocket).
- [`src/routers`](../api/src/routers) : Contains the routers for the different endpoints.
- [`src/utils`](../api/src/utils) : Contains the utility functions used in the API.

## Endpoints

Endpoints are noted with this format : `METHOD /path`  
Every variable will be noted with `:id`  
If you run the API locally (see [the contribution guidelines](../CONTRIBUTING.md#working-on-data-fairprocessingsapi)), you can access the API at `http://localhost:8082/api/v1` (or `http://localhost:5600/api/v1` if you're running the entire app).

<details>
<summary><a href="#limits">/limits</a></summary>

- [GET /limits/](#get-limits)
- [GET /limits/:type/:id](#get-limitstypeid)
- [POST /limits/:type/:id](#post-limitstypeid)

</details>

<details>
<summary><a href="#plugins">/plugins</a></summary>

- [GET /plugins/](#get-plugins)
- [POST /plugins/](#post-plugins)
- [GET /plugins/:id](#get-pluginsid)
- [DELETE /plugins/:id](#delete-pluginsid)
- [PUT /plugins/:id/access](#put-pluginsidaccess)
- [PUT /plugins/:id/config](#put-pluginsidconfig)

</details>

<details>
<summary><a href="#plugins-registry">/plugins-registry</a></summary>

- [GET /plugins-registry/](#get-plugins-registry)

</details>

<details>
<summary><a href="#processings">/processings</a></summary>

- [GET /processings/](#get-processings)
- [POST /processings/](#post-processings)
- [PATCH /processings/:id](#patch-processingsid)
- [GET /processings/:id](#get-processingsid)
- [DELETE /processings/:id](#delete-processingsid)
- [GET /processings/:id/webhook-key](#get-processingsidwebhook-key)
- [DELETE /processings/:id/webhook-key](#delete-processingsidwebhook-key)
- [POST /processings/:id/_trigger](#post-processingsid_trigger)

</details>

<details>
<summary><a href="#runs">/runs</a></summary>

- [GET /runs/](#get-runs)
- [GET /runs/:id](#get-runsid)
- [POST /runs/:id/_kill](#post-runsid_kill)

</details>

## /limits

The `limits` endpoints are used for managing and retrieving limit settings for various entities, such as services or users. These settings control usage or access limitations. They are utilized by the client service to retrieve and configure limits and the consumption of processing time.

### `GET /limits/`

Lists limit settings for all entities, filtered by optional query parameters. This endpoint is protected and requires super admin permissions.  

**Parameters**

- `type` (query, optional, string) : Filter by the entity type.
- `id` (query, optional, string) : Filter by the unique identifier of the entity.
  
**Responses**

- a list of limit settings, limited to 10,000 entries

### `GET /limits/:type/:id`

Retrieves the limit settings for a specific entity. Access is limited to account members for their own information.  

**Parameters**

- `type` (path, string) : The entity type.
- `id` (path, string) : The unique identifier of the entity.

**Responses**

- the limit settings for the entity

### `POST /limits/:type/:id`

Creates or updates the limit settings for a specific entity, identified by its type and ID. This endpoint is protected and requires super admin permissions. It is used by client services to configure and update the limits and the processing time consumption for specific entities.  

**Parameters**

- (Request body) :
  - Required fields : `id`, `type`, `lastUpdate`.
  - Optional fields : `name`, `defaults`, `processings_seconds`.
  
> `processings_seconds` should include `limit` and `consumption` numbers.

**Responses**

- the created or updated limit settings

## /plugins

The `plugins` endpoints are used for managing and retrieving plugins, which are used to extend the functionality of the Data Fair platform. Plugins are managed within two main directories :

- `pluginsDir`: Located at `config.dataDir/plugins`, this is where installed plugins are stored.
- `tmpDir`: Utilized for temporary operations, located either at `config.dataDir/tmp` or `config.tmpDir`.

### `GET /plugins/`

Retrieves a list of all installed plugins. This endpoint can filter plugins based on access rights if the `privateAccess` query parameter is provided, matching the current session's account type and ID.

**Parameters**

- `privateAccess` (query, optional, string) : Specifies the access filter in the format `[type]:[id]`, allowing for the retrieval of plugins with matching access rights.

**Responses**

- `400` : the request is not made by an admin without specifying `privateAccess`
- `403` : `privateAccess` does not match the current session
- An array of plugin objects

```json
{
  "count": "The number of plugins",
  "results": [
    {
      "name": "The plugin name (npm)",
      "description": "The plugin description (npm)",
      "version": "The plugin version",
      "dist-tag": "The plugin distribution tag",
      "id": "The plugin identifier (folder name)",
      "pluginConfigSchema": "The plugin configuration schema",
      "processingConfigSchema": "The plugin processing configuration schema",
      "customName": "The plugin custom name defined on configuration (or the name if not defined)"
    },
    {"..."}
  ],
  "facets": {
    "usages": {
      "id": "The plugin's number of usages in processings"
    }
  }
}
```

### `POST /plugins/`

Allows for the installation of a new plugin or updating an existing plugin. Requires super admin permissions and includes the plugin's basic information in the request body. It installs the plugin in the `pluginsDir`, overwriting the existing one if present.

**Permissions**

- Super Admin only.

**Parameters**

- (Request body) : Should include the plugin's `name`, `description`, `version`, and `distTag`.

**Responses**

- `403` : The request is not made by a super admin
- `400` : The plugin's basic information is not provided
- A plugin object

```json
{
  "name": "The plugin name (npm)",
  "description": "The plugin description (npm)",
  "version": "The plugin version",
  "dist-tag": "The plugin distribution tag",
  "id": "The plugin identifier (folder name)",
  "pluginConfigSchema": "The plugin configuration schema",
  "processingConfigSchema": "The plugin processing configuration schema"
}
```

### `GET /plugins/:id`

Fetches detailed information about a specific plugin, identified by its unique `id`. This endpoint requires the user to be authenticated and is intended to provide configuration and access details for the plugin.

**Parameters**

- `id` (path, string) : The unique identifier of the plugin.

**Responses**

- `404` : The plugin is not found
- A plugin object :

```json
{
  "name": "The plugin name (npm)",
  "description": "The plugin description (npm)",
  "version": "The plugin version",
  "dist-tag": "The plugin distribution tag",
  "id": "The plugin identifier (folder name)",
  "pluginConfigSchema": "The plugin configuration schema",
  "processingConfigSchema": "The plugin processing configuration schema",
  "customName": "The plugin custom name defined on configuration (or the name if not defined)"
}
```

### `DELETE /plugins/:id`

Removes a specific plugin from the system, including its configuration and access control settings. This operation requires super admin permissions and is identified by the plugin's unique `id`.

**Permissions**

- Super Admin only.

**Parameters**

- `id` (path, string) : The unique identifier of the plugin.

**Responses**

- `204` : The plugin is successfully removed

### `PUT /plugins/:id/access`

Updates the access control settings for a specific plugin, identified by its `id`. This endpoint allows super admins to modify who can access the plugin, based on the contents of the request body.

**Permissions**

- Super Admin only.

**Parameters**

- `id` (path, string) : The unique identifier of the plugin.
- (Request body) : Should include the `access` object : `{ "public": boolean, "privateAccess": Array }`

**Responses**

- The request body upon successful update

### `PUT /plugins/:id/config`

Updates the configuration for a specific plugin identified by its `id`. This operation expects the new configuration to match the plugin's configuration schema.

**Permissions**

- Super Admin only.

**Parameters**

- `id` (path, string) : The unique identifier of the plugin.

**Responses**

- `400` : The plugin's configuration does not match the schema
- The request body upon successful update

## /plugins-registry

The `plugins-registry` endpoints are used for searching and retrieving plugins from the npm registry, which can be integrated into the Data Fair platform. This functionality is crucial for discovering new plugins that can extend the capabilities of the platform with additional data processing functionalities.

### `GET /plugins-registry/`

Performs a search query against the npm registry for plugins tagged with `data-fair-processings-plugin`. This endpoint is designed to facilitate finding plugins suitable for integration with the application by leveraging keywords to filter search results. It returns objects that include the `name`, `description`, `version`, and `dist-tag` of each plugin found.

**Parameters**

- `q` (query, optional, string) : A search query to filter plugins based on their name, description, or other characteristics. The search is further refined to only include packages with the `data-fair-processings-plugin` keyword.
- `showAll` (query, optional, boolean) : Allows to show plugins and all their versions (differents distTag), useful for displaying test versions and not only latest ones. Note that using this parameter drastically increases the response time.

**Caching**

- Results are cached for 5 minutes to reduce load on the npm registry and improve response times for subsequent queries.

**Purpose**

- This endpoint serves as a bridge between the application and the npm registry, enabling users to discover and evaluate plugins that can be integrated into their data processing workflows.

**Considerations**

- Future enhancements may include exploring mechanisms to send data as soon as it's loaded, possibly utilizing websockets, to provide real-time updates to users searching for plugins.

## /processings

The `processings` endpoints are used for managing and retrieving processing configurations, which define the execution of data processing tasks on the Data Fair platform.

> a full processing object : `{ _id, title, plugin, owner, scheduling, updated, created, active, nextRun, lastRun, [(if superAdmin) permissions, config], webhookKey}`

> `webhookKey` is never returned in the response

> `config` and `permissions` are only returned for super admins

### `GET /processings/`

Retrieves a list of all processing configurations stored in the database. Supports query parameters for pagination, sorting, and filtering based on user permissions. Designed to fetch processing configurations accessible to authenticated users. Parameters like `size`, `showAll`, `sort`, and `select` generate database queries with `findUtils`, ensuring only permitted data is fetched and sensitive parts are cleared for non-admin users.

**Parameters**

- `size` (query, optional, number) : Default is 10
- `page` (query, optional, number) : Control pagination.
- `skip` (query, optional, number) : Control pagination.
- `showAll` (query, optional, boolean) : Show all processing configurations. (Always true for super admins)
- `sort` (query, optional, string) : Sort the results, with sorting by `updated.date` in descending order as a common use case.
- `select` (query, optional, string) : A list of string separated by `,` to select fields to return.
- `plugins` (query, optional, string) : A list of plugin ids to filter by, separated by `,`.
- `statuses` (query, optional, string) : A list of statuses to filter by, separated by `,`. Available statuses are : `error`, `finished`, `kill`, `killed`, `none`, `running`, `scheduled`, `triggered`.

**Responses**

- An array of processing objects

### `POST /processings/`

Creates a new processing. It generates a unique `_id`, a `webhookKey`, and sets creation and update timestamps to the current time. Scheduling defaults to type `trigger` if not specified. Comprehensive checks ensure the processing's validity before saving it to the database.

**Permissions**

- Admin or Super Admin only.

**Parameters**

- (Request body) : Should include `title`, `plugin`
  - Optional fields : `scheduling`, `owner`

**Responses**

- `403` : If the owner is defined but not a super admin
- `403` : If the owner does not have the admin permission
- `403` : If the owner does not have the permission on this plugin
- `200` & the processing object : The processing is successfully created

### `PATCH /processings/:id`

Updates specific attributes of a processing configuration. Changes the update timestamp, verifies the validity of all modifications, and updates the database. Adjusts processing execution based on the active status and scheduling, potentially stopping or scheduling runs.

**Parameters**

- `id` (path, string) : The unique identifier of the processing configuration.
- (Request body) : Should include `active`, `title`, `scheduling`, `config`.

**Responses**

- `400` : If a readOnly key is modified
- `403` : If the owner does not have the permission on this processing
- `404` : If the processing is not found
- `200` & the processing object : The processing is successfully updated

### `GET /processings/:id`

Retrieves data about a specific processing configuration.

**Permissions**

- `admin`, `exec`, or `read` permissions

**Parameters**

- `id` (path, string) : The unique identifier of the processing configuration.

**Responses**

- `403` : The user does not have the permission on this processing
- `404` : The processing is not found
- The processing object

### `DELETE /processings/:id`

Deletes a processing configuration along with all associated runs and its processing directory. It performs thorough clean-up and security checks before executing the delete operation.

**Permissions**

- `admin` or `exec` permissions

**Parameters**

- `id` (path, string) : The unique identifier of the processing configuration to be deleted.

**Responses**

- `403` : The user does not have the permission on this processing
- `404` : The processing is not found
- `204` : The processing is successfully deleted

### `GET /processings/:id/webhook-key` & `DELETE /processings/:id/webhook-key`

Retrieves or regenerates the webhook key for a specific processing configuration, demanding admin permissions for access. Deletion generates a new webhook key, enhancing security by allowing periodic key renewal.

**Parameters**

- `id` (path, string) : The unique identifier of the processing configuration.

**Responses**

- `403` : The user does not have the permission on this processing
- `404` : The processing is not found
- (GET) The webhook key

### `POST /processings/:id/_trigger`

Triggers the execution of a specified processing configuration. Supports optional delay and custom webhook key parameters for flexible execution planning. Handles cases of non-active processing with appropriate responses and ensures only authorized triggers.

**Parameters**

- `id` (path, string) : The unique identifier of the processing configuration.
- `key` (query, optional, string) : The webhook key for triggering the processing.
- `delay` (query, optional, number) : Delay in seconds before the processing starts.

**Responses**

- `403` : The user does not have the permission on this processing
- `404` : The processing is not found
- `409` : The processing is not active
- The run object

```json
{
  "_id": "string",
  "owner": "string",
  "processing": {
    "_id": "string",
    "title": "string"
  },
  "createdAt": "Date",
  "scheduledAt": "Date",
  "status": "triggered",
  "log": [],
  "permissions": []
}
```

## /runs

The `runs` endpoints are used for managing and retrieving run configurations, which represent the execution of processing configurations on the Data Fair platform. Run configurations include sensitive parts such as `permissions`, which are meticulously managed to ensure that visibility and modifications are appropriately restricted based on the user's permissions.

### `GET /runs/`

Retrieves a list of run configurations, excluding logs to streamline the response. This endpoint supports query parameters for pagination, sorting, and filtering based on user permissions and the status of runs. For super admins, `showAll` is implicitly true, allowing a comprehensive view of all runs. The response includes a list of run objects with their logs and permissions included only if accessed by an admin.

**Query Parameters**

- `size`, `page`, `skip` : Control pagination of the response.
- `sort` : Determines the order in which run configurations are returned.
- `select` : Specifies the fields to be included in the response, excluding logs by default.

### `GET /runs/:id`

Fetches detailed information about a specific run configuration, including logs. Ensures access is granted based on `admin`, `exec`, or `read` permissions associated with the run's processing configuration. Returns the run object with detailed logs and permissions included for those authorized.

**Parameters**

- `id` (path, string) : The unique identifier of the run configuration.

### `POST /runs/:id/_kill`

Requests the termination of a specified run configuration, changing its status to 'kill'. This operation is permitted for users with `admin` or `exec` permissions related to the run's processing configuration. Updates the database to reflect the run's killed status and returns the updated run object, including its detailed logs and permissions for authorized users.

**Parameters**

- `id` (path, string) : The unique identifier of the run configuration to be terminated.
