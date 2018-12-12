import React, { Component } from 'react';
import Head from 'next/head';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import styled from 'styled-components';
import Error from './ErrorMessage';

const SingleItemStyles = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  box-shadow: ${props => props.theme.bs};
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  min-height: 800px;
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .details {
    margin: 3rem;
    font-size: 2rem;
  }
`;

const SINGLE_ITEM_QUERY = gql`
  query SINGLE_ITEM_QUERY($id: ID!) {
    item(where: { id: $id }) {
      title
      description
      price
      image
      largeImage
    }
  }
`;

class SingleItem extends Component {
  render() {
    const { id } = this.props;
    return (
      <Query
        query={SINGLE_ITEM_QUERY}
        variables={{
          id
        }}
      >
        {({ data, loading, error }) => {
          if (loading) return <p>Loading...</p>;
          if (!data.item) return <p>No item found for {id}.</p>;
          const { title, largeImage, price, description } = data.item;
          return (
            <div>
              <Error error={error} />
              <SingleItemStyles>
                <Head>
                  <title>Sick Fits | {title}</title>
                </Head>
                {largeImage && <img src={largeImage} alt={title} />}
                <div className="details">
                  <h2>Viewing: {title}</h2>
                  <p>{description}</p>
                </div>
              </SingleItemStyles>
            </div>
          );
        }}
      </Query>
    );
  }
}

export default SingleItem;
