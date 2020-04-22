/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

import React, { Component } from "react";
import {
  PageSection,
  PageSectionVariants,
  Stack,
  StackItem,
  Text,
  TextContent,
  TextVariants,
} from "@patternfly/react-core";
import { Split, SplitItem } from "@patternfly/react-core";
import TopologyViewer from "./topologyViewer";
import { Icap } from "../../utilities";
import LastUpdated from "../../lastUpdated";

class TopologyPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isDropDownOpen: false,
      options: {
        graph: {
          traffic: false,
          utilization: false,
        },
        link: { stat: "bytes_out" },
      },
    };
  }

  handleChangeView = (viewType) => {
    this.props.handleChangeViewType(viewType);
    //this.setState({ viewType });
  };

  handleChangeOption = (option) => {
    const { options } = this.state;
    options.link.stat = option;
    this.setState({ options }, () => {
      this.graphRef.restart();
    });
  };

  handleChangeLastUpdated = () => {
    this.updatedRef.update();
  };

  update = () => {
    this.graphRef.update();
    this.handleChangeLastUpdated();
  };

  render() {
    return (
      <PageSection
        variant={PageSectionVariants.light}
        className="topology-page"
      >
        <Stack>
          <StackItem className="overview-header">
            <Split gutter="md">
              <SplitItem>
                <TextContent>
                  <Text className="overview-title" component={TextVariants.h1}>
                    {Icap(this.props.view)}s
                  </Text>
                </TextContent>
              </SplitItem>
              <SplitItem isFilled>
                <TextContent>
                  <LastUpdated ref={(el) => (this.updatedRef = el)} />
                </TextContent>
              </SplitItem>
            </Split>
          </StackItem>
          <StackItem className="overview-table">
            <TopologyViewer
              ref={(el) => (this.graphRef = el)}
              type={this.props.type}
              service={this.props.service}
              view={this.props.view}
              location={this.props.location}
              viewType={this.props.getViewType()}
              options={this.state.options}
              handleChangeView={this.handleChangeView}
              handleChangeOption={this.handleChangeOption}
              getShowStat={this.props.getShowStat}
              getShowSankey={this.props.getShowSankey}
              getShowWidth={this.props.getShowWidth}
              getShowColor={this.props.getShowColor}
              getViewType={this.props.getViewType}
              handleChangeShowStat={this.props.handleChangeShowStat}
              handleChangeSankey={this.props.handleChangeSankey}
              handleChangeColor={this.props.handleChangeColor}
              handleChangeWidth={this.props.handleChangeWidth}
              handleChangeViewType={this.props.handleChangeViewType}
              handleChangeLastUpdated={this.handleChangeLastUpdated}
            />
          </StackItem>
        </Stack>
      </PageSection>
    );
  }
}

export default TopologyPage;