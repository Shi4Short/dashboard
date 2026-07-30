import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints/common";
import type { NetworkingContact } from "./types";

// The database this app knows how to sync. Not secret (visible in the
// Notion URL) — the actual access control is the integration token below,
// which must be explicitly shared with this database in Notion.
const NETWORKING_DATABASE_ID = process.env.NOTION_NETWORKING_DATABASE_ID || "ccd2b3c993404ab3a658be9606746e7c";

let client: Client | undefined;
let cachedDataSourceId: string | undefined;

function getClient(): Client {
  if (!client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is not set");
    }
    client = new Client({ auth: token });
  }
  return client;
}

async function getNetworkingDataSourceId(): Promise<string> {
  if (!cachedDataSourceId) {
    const notion = getClient();
    const database = await notion.databases.retrieve({ database_id: NETWORKING_DATABASE_ID });
    const dataSource = "data_sources" in database ? database.data_sources[0] : undefined;
    if (!dataSource) {
      throw new Error("Notion database has no queryable data source");
    }
    cachedDataSourceId = dataSource.id;
  }
  return cachedDataSourceId;
}

function plainText(richText: { plain_text: string }[] | undefined): string {
  return (richText || []).map((t) => t.plain_text).join("");
}

export async function fetchNetworkingContacts(): Promise<NetworkingContact[]> {
  const notion = getClient();
  const dataSourceId = await getNetworkingDataSourceId();
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results.filter((page): page is PageObjectResponse => "properties" in page).map((page) => {
    const props = page.properties;
    const name = props.Name?.type === "title" ? plainText(props.Name.title) : "";
    const status = props.Status?.type === "status" ? (props.Status.status?.name ?? "") : "";
    const platform = props.Platform?.type === "select" ? (props.Platform.select?.name ?? "") : "";
    const notes = props.Notes?.type === "rich_text" ? plainText(props.Notes.rich_text) : "";
    const dateContacted =
      props["Date Contacted"]?.type === "date" ? (props["Date Contacted"].date?.start ?? null) : null;

    return {
      id: page.id,
      name,
      status,
      platform,
      notes,
      dateContacted,
      url: page.url,
    };
  });
}
