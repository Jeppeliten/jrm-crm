# Database Structure - Azure Cosmos DB (MongoDB API)

This document describes the database structure for the JRM CRM system using Azure Cosmos DB with MongoDB API.

## Mermaid Diagram

```mermaid
erDiagram
    %% Core Entities
    Users {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string namn "User name"
        string roll "Role: admin, sales"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    Segments {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string name "Segment name"
        string icon "Icon character"
        string color "Color theme"
        string description "Segment description"
        string pricingModel "per-agent, enterprise, custom"
        datetime createdAt "Creation timestamp"
    }

    Brands {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string namn "Brand name"
        string segmentId FK "Reference to Segments"
        object centralContract "Central contract info"
        string website "Brand website"
        string telefon "Phone number"
        string email "Email address"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    Companies {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string namn "Company name"
        string brandId FK "Reference to Brands"
        string segmentId FK "Reference to Segments"
        string stad "City"
        string address "Street address"
        string postalCode "Postal code"
        string postCity "Post city"
        string orgNumber "Organization number"
        string status "kund, prospekt, ej"
        string pipelineStage "Pipeline stage"
        number potentialValue "Potential value"
        number payment "Monthly payment (MRR)"
        string product "Product type"
        string customerNumber "Customer number"
        string ansvarigSäljareId FK "Responsible salesperson"
        boolean centralContract "Central contract flag"
        boolean claudeSonnet4Enabled "AI feature flag"
        string website "Company website"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    Agents {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string förnamn "First name"
        string efternamn "Last name"
        string email "Email address"
        string telefon "Phone number"
        string companyId FK "Reference to Companies"
        string officeName "Office name"
        string status "kund, prospekt, ej"
        object licens "License information"
        string registrationType "Registration type"
        string productsImported "Imported products"
        string matchType "Match type"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    Contacts {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string entityType "brand, company, agent"
        string entityId FK "Reference to entity"
        string namn "Contact name"
        string roll "Role/title"
        string email "Email address"
        string telefon "Phone number"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    Tasks {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string title "Task title"
        datetime dueAt "Due date"
        string ownerId FK "Task owner (Users.id)"
        boolean done "Completion status"
        string entityType "brand, company, agent"
        string entityId FK "Reference to entity"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    Notes {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string entityType "brand, company, agent, general"
        string entityId FK "Reference to entity"
        string text "Note content"
        string authorId FK "Author (Users.id)"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last update timestamp"
    }

    %% Audit and System Collections
    AuditLog {
        string _id PK "MongoDB ObjectId"
        string id "Unique identifier"
        string type "Action type"
        string userId "User who performed action"
        object data "Action data"
        datetime timestamp "Action timestamp"
    }

    SystemConfig {
        string _id PK "MongoDB ObjectId"
        string key "Configuration key"
        object value "Configuration value"
        datetime updatedAt "Last update timestamp"
    }

    %% Relationships
    Segments ||--o{ Brands : "has many"
    Segments ||--o{ Companies : "has many"
    Brands ||--o{ Companies : "has many"
    Companies ||--o{ Agents : "has many"
    Users ||--o{ Tasks : "owns"
    Users ||--o{ Notes : "authors"
    
    %% Polymorphic relationships (entityType/entityId)
    Brands ||--o{ Contacts : "has contacts"
    Companies ||--o{ Contacts : "has contacts"
    Agents ||--o{ Contacts : "has contacts"
    
    Brands ||--o{ Tasks : "has tasks"
    Companies ||--o{ Tasks : "has tasks"
    Agents ||--o{ Tasks : "has tasks"
    
    Brands ||--o{ Notes : "has notes"
    Companies ||--o{ Notes : "has notes"
    Agents ||--o{ Notes : "has notes"
```

## Collection Details

### Core Business Collections

#### Users
- **Purpose**: System users and authentication
- **Key Fields**: `namn` (name), `roll` (role)
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ roll: 1 }`

#### Segments
- **Purpose**: Business segments (real estate, banking, etc.)
- **Key Fields**: `name`, `pricingModel`
- **Indexes**: `{ id: 1 }` (unique)

#### Brands
- **Purpose**: Brand/franchise chains
- **Key Fields**: `namn` (name), `segmentId`, `centralContract`
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ segmentId: 1 }`
  - `{ namn: "text" }` (text search)

#### Companies
- **Purpose**: Individual offices/companies
- **Key Fields**: `namn`, `brandId`, `status`, `payment`
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ brandId: 1 }`
  - `{ segmentId: 1 }`
  - `{ status: 1 }`
  - `{ customerNumber: 1 }`
  - `{ orgNumber: 1 }`
  - `{ namn: "text" }` (text search)

#### Agents
- **Purpose**: Individual agents/brokers
- **Key Fields**: `förnamn`, `efternamn`, `companyId`, `licens`
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ companyId: 1 }`
  - `{ email: 1 }`
  - `{ status: 1 }`
  - `{ "licens.status": 1 }`

### Activity Collections

#### Contacts
- **Purpose**: Decision makers and key contacts
- **Key Fields**: `entityType`, `entityId`, `namn`, `roll`
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ entityType: 1, entityId: 1 }`

#### Tasks
- **Purpose**: To-do items and follow-ups
- **Key Fields**: `title`, `ownerId`, `done`, `dueAt`
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ ownerId: 1 }`
  - `{ done: 1 }`
  - `{ dueAt: 1 }`
  - `{ entityType: 1, entityId: 1 }`

#### Notes
- **Purpose**: Free-text notes and comments
- **Key Fields**: `text`, `authorId`, `entityType`, `entityId`
- **Indexes**: 
  - `{ id: 1 }` (unique)
  - `{ authorId: 1 }`
  - `{ entityType: 1, entityId: 1 }`
  - `{ text: "text" }` (text search)

### System Collections

#### AuditLog
- **Purpose**: System audit trail
- **Key Fields**: `type`, `userId`, `timestamp`
- **Indexes**: 
  - `{ timestamp: -1 }`
  - `{ type: 1 }`
  - `{ userId: 1 }`

#### SystemConfig
- **Purpose**: System configuration and settings
- **Key Fields**: `key`, `value`
- **Indexes**: `{ key: 1 }` (unique)

## Data Relationships

### Hierarchical Structure
```
Segments
└── Brands
    └── Companies
        └── Agents
```

### Polymorphic Associations
- **Contacts**: Can be associated with Brands, Companies, or Agents
- **Tasks**: Can be associated with Brands, Companies, or Agents
- **Notes**: Can be associated with Brands, Companies, Agents, or be general

### Reference Integrity
- `Companies.brandId` → `Brands.id`
- `Agents.companyId` → `Companies.id`
- `Tasks.ownerId` → `Users.id`
- `Notes.authorId` → `Users.id`
- Polymorphic: `entityId` references depend on `entityType`

## Cosmos DB Specific Considerations

### Partition Strategy
- **Recommended Partition Key**: `segmentId` for most collections
- **Alternative**: Use `brandId` for agent-heavy workloads
- **Small Collections**: Use synthetic partition key

### Indexing Strategy
- **Automatic**: All properties auto-indexed by default
- **Custom**: Create composite indexes for common query patterns
- **Text Search**: Enable for `namn`, `text` fields

### Document Size
- **Typical**: 1-10KB per document
- **Maximum**: 2MB per document (Cosmos DB limit)
- **Optimization**: Consider embedding vs. referencing

### Query Patterns
- **Cross-partition**: Minimize with good partition key
- **Point reads**: Use `id` field for single document retrieval
- **Range queries**: Leverage indexed fields like `dueAt`, `status`

## Migration from JSON File
The current system uses a single `state.json` file. Migration to Cosmos DB involves:

1. **Split by Collection**: Separate arrays into individual collections
2. **Add Metadata**: Include `createdAt`, `updatedAt` timestamps
3. **Maintain IDs**: Keep existing `id` fields, let MongoDB generate `_id`
4. **Index Creation**: Set up required indexes
5. **Data Validation**: Ensure referential integrity

## Example Documents

### Brand Document
```json
{
  "_id": "ObjectId(...)",
  "id": "b1",
  "namn": "Fantastic Frank",
  "segmentId": "real-estate",
  "centralContract": {
    "active": true,
    "product": "Premium",
    "mrr": 50000
  },
  "website": "https://fantasticfrank.se",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-11-03T14:22:00Z"
}
```

### Company Document
```json
{
  "_id": "ObjectId(...)",
  "id": "c1",
  "namn": "Fantastic Frank Malmö",
  "brandId": "b1",
  "segmentId": "real-estate",
  "stad": "Malmö",
  "status": "kund",
  "payment": 15000,
  "customerNumber": "12345678",
  "createdAt": "2024-01-15T10:35:00Z",
  "updatedAt": "2024-11-03T14:22:00Z"
}
```

### Agent Document
```json
{
  "_id": "ObjectId(...)",
  "id": "a1",
  "förnamn": "Anna",
  "efternamn": "Andersson",
  "email": "anna@ff.se",
  "companyId": "c1",
  "status": "kund",
  "licens": {
    "status": "aktiv",
    "typ": "Premium"
  },
  "createdAt": "2024-01-15T10:40:00Z",
  "updatedAt": "2024-11-03T14:22:00Z"
}
```