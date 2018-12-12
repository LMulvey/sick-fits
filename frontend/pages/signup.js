import styled from 'styled-components';
import Signup from '../components/Signup';
import Signin from '../components/Signin';
import User from '../components/User';
import RequestReset from '../components/RequestReset';

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-gap: 20px;
`;

const SignupPage = props => (
  <User>
    {({ data: { me } }) =>
      !me ? (
        <Columns>
          <Signup />
          <Signin />
          <RequestReset />
        </Columns>
      ) : (
        <h4>You're already signed in!</h4>
      )
    }
  </User>
);

export default SignupPage;
