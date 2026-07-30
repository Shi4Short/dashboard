import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints/common";
import { NOTION_PERIODS, type NetworkingContact, type NotionGoalTask, type NotionPeriod } from "./types";

// The databases this app knows how to sync. Not secret (visible in the
// Notion URL) — the actual access control is the integration token below,
// which must be explicitly shared with each database in Notion.
const NETWORKING_DATABASE_ID = process.env.NOTION_NETWORKING_DATABASE_ID || "ccd2b3c993404ab3a658be9606746e7c";
const GOALS_TASKS_DATABASE_ID = process.env.NOTION_GOALS_TASKS_DATABASE_ID || "62b9c1d7c21e49319e41542f44e4aa5a";

let client: Client | undefined;
const dataSourceIdCache = new Map<string, string>();

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

async function getDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) return cached;

  const notion = getClient();
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSource = "data_sources" in database ? database.data_sources[0] : undefined;
  if (!dataSource) {
    throw new Error("Notion database has no queryable data source");
  }
  dataSourceIdCache.set(databaseId, dataSource.id);
  return dataSource.id;
}

function plainText(richText: { plain_text: string }[] | undefined): string {
  return (richText || []).map((t) => t.plain_text).join("");
}

export async function fetchNetworkingContacts(): Promise<NetworkingContact[]> {
  const notion = getClient();
  const dataSourceId = await getDataSourceId(NETWORKING_DATABASE_ID);
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

export async function fetchGoalsAndTasks(): Promise<NotionGoalTask[]> {
  const notion = getClient();
  const dataSourceId = await getDataSourceId(GOALS_TASKS_DATABASE_ID);
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results
    .filter((page): page is PageObjectResponse => "properties" in page)
    .map((page) => {
      const props = page.properties;
      const name = props.Name?.type === "title" ? plainText(props.Name.title) : "";
      const date = props.Date?.type === "date" ? (props.Date.date?.start ?? null) : null;
      const periodName = props.Period?.type === "select" ? props.Period.select?.name : undefined;
      const period = (NOTION_PERIODS as readonly string[]).includes(periodName ?? "")
        ? (periodName as NotionPeriod)
        : "";
      const notes = props.Notes?.type === "rich_text" ? plainText(props.Notes.rich_text) : "";
      const done = props.Status?.type === "status" && props.Status.status?.name === "Done";

      return { id: page.id, name, date, period, notes, done };
    });
}
