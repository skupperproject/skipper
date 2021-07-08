import React from "react";

import { utils } from "../../utilities";
export const LINKDOWN_VALUE = "Disconnected";

export class LinksRows {
  // determine if the Name column should be a link to the details page
  isDetailLink = (value, extraInfo, detailsLink) => {
    // connected links no longer have a site_id, so don't show the link to the site details page
    /*
    if (extraInfo.rowData.data.Status !== LINKDOWN_VALUE) {
      return detailsLink(value, extraInfo);
    }
    */
    return <span>{value}</span>;
  };

  // Columns to display in the links/linked sites table
  LinkFields = [
    { title: "Name", field: "Name", isDetailLink: this.isDetailLink },
    {
      title: "Connected",
      field: "connected",
    },
    {
      title: "Configured",
      field: "configured",
    },
    {
      title: "Type",
      field: "Site type",
    },
    {
      title: "Cost",
      field: "Cost",
    },
    { title: "Linked", field: "Linked" },
  ];

  // called by tableViewer to get the rows
  fetch = (emptyRows, VANservice, formatterData, dataFilter) => {
    const dataKey = "links";
    this.showUnlink = formatterData.unlink;

    return new Promise((resolve) => {
      VANservice.getSiteInfo().then((siteInfo) => {
        let data = siteInfo[dataKey];

        if (dataFilter) {
          data = dataFilter(data);
        }
        const rows = data.map((row) => {
          // add cardData so the sub table viewer has the correct info
          // find the service for this row
          const sites = VANservice.VAN.sites.filter(
            (s) => s.site_id === row.site_id
          );
          if (sites.length > 0) {
            const site = sites[0];
            row.cardData = { ...site };
            row.cardData.name = site.site_name;
            row.cardData.shortName = utils.shortName(site.site_name);
            row.cardData.nodeType = "cluster";
          }
          if (row.Linked) {
            row.Linked = utils.convertDate(row.Linked, "date");
          }
          row.connected = row.connected ? "True" : "";
          row.configured = row.configured ? "True" : "";
          return row;
        });
        resolve(siteInfo[dataKey].length > 0 ? rows : emptyRows);
      });
    });
  };
}
