import React from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Divider, useTheme, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import MovieIcon from '@mui/icons-material/Movie';
import BurstModeIcon from '@mui/icons-material/BurstMode';

const drawerWidth = 240;

const Sidebar = ({ isOpen, onClose, isMobile }) => {
  const theme = useTheme();

  const drawerContent = (
    <div>
      <Box sx={{ ...theme.mixins.toolbar }} />
      <Divider />
      <List>
        <ListItem button component={Link} to="/">
          <ListItemIcon>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItem>
        <ListItem button component={Link} to="/projects">
          <ListItemIcon>
            <MovieIcon />
          </ListItemIcon>
          <ListItemText primary="Projects" />
        </ListItem>
        <ListItem button component={Link} to="/shot-suggestor">
          <ListItemIcon>
            <BurstModeIcon />
          </ListItemIcon>
          <ListItemText primary="Shot Suggestor" />
        </ListItem>
      </List>
    </div>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={isOpen}
      onClose={onClose}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile.
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar; 