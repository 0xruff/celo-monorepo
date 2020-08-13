import * as React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { H4 } from 'src/fonts/Fonts'
import Chainlink from 'src/icons/Chainlink'
import { TweetLogo } from 'src/icons/TwitterLogo'
import { useScreenSize } from 'src/layout/ScreenSize'
import Button, { BTN, SIZE } from 'src/shared/Button.3'
import { colors, fonts, standardStyles, textStyles, typeFaces } from 'src/styles'
import { copyToClipboad } from 'src/utils/utils'
import LightButon from './LightButton'

const WIDTH = 300

export default function SideBar({ isOpen }) {
  const { isMobile } = useScreenSize()
  const openStyle = isMobile ? styles.showSideMobile : styles.showSide
  return (
    <>
      <View style={[styles.expander, !isMobile && isOpen && styles.expanderOpen]} />
      <View style={[styles.root, isOpen ? openStyle : styles.hideSide]}>
        <View>
          <H4
            style={[
              textStyles.italic,
              standardStyles.elementalMarginBottom,
              isMobile && styles.mobileTitle,
            ]}
          >
            As Wealth Flowers
          </H4>
          <Text style={[fonts.p, styles.aside]}>
            This art form is a testament to the creative trinity of code, poetry, and illustration.
            A work centered around channelling the Celo story,{' '}
            <Text style={textStyles.italic}>As Wealth Flowers</Text> is a gift of optimism — giving
            form to a spirit of collective prosperity, and celebrating it when seen brought to life.
          </Text>
          <Text style={[fonts.p, styles.aside, standardStyles.elementalMarginTop]}>
            Kuneco is an Esperanto word signifying togetherness, and this communal interdependence
            forms the heart of the creators’ work from within Celo. As a sacred gift, the spirit
            embodied within this art piece gathers a space for intimate connection and an expressive
            tenor of togetherness — in dedication to making conditions for collective prosperity to
            flower throughout the world.
          </Text>
          <Button
            style={styles.chevronButton}
            kind={BTN.DARKNAKED}
            text="Read about the poem"
            href="#poemlink"
            size={SIZE.normal}
          />
          <Button
            kind={BTN.DARKNAKED}
            text="Read about the art"
            href="#artlink"
            style={styles.chevronButton}
            size={SIZE.normal}
          />
          <View style={[standardStyles.row, standardStyles.blockMarginMobile]}>
            <TweetButton />
            <LightButon onPress={copyURL} style={styles.copyButton}>
              <Chainlink size={16} color={colors.dark} /> Copy
            </LightButon>
          </View>
        </View>
        <View style={standardStyles.blockMarginBottomMobile}>
          <View style={[styles.line, standardStyles.elementalMarginBottom]} />
          <Contributor role="Poetry" name="Gabrielle Micheletti, cLabs" />
          <Contributor role="Code & Animation" name="Aaron DeRuvo, cLabs" />
          <Contributor role="Art & Design" name="Taylor Lahey, cLabs" />
        </View>
      </View>
    </>
  )
}

function copyURL() {
  copyToClipboad(window.location.href)
}

const TweetButton = React.memo(() => {
  const text = encodeURI('Blooming more beautiful money, as wealth flowers')
  const url = 'celo.org/wealth-flowers'
  return (
    <>
      <LightButon
        href={`https://twitter.com/intent/tweet?hashtags=celoflora&related=celoOrg&via=celoOrg&text=${text}&url=${url}`}
      >
        <TweetLogo height={16} color={colors.dark} /> Tweet
      </LightButon>
    </>
  )
})

function Contributor({ role, name }) {
  return (
    <View style={styles.contributor}>
      <Text style={[fonts.mini, styles.role]}>{role}</Text>
      <Text style={fonts.legal}>{name}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  expander: {
    width: 0,
    willChange: 'width',
    transitionProperty: 'width',
    transitionDuration: '800ms',
  },
  expanderOpen: {
    width: WIDTH,
  },
  root: {
    backgroundColor: colors.white,
    justifyContent: 'space-between',
    minHeight: 'calc(100vh - 50px)',
    willChange: 'transform',
    transitionProperty: 'transform',
    transitionDuration: '1200ms',
    width: WIDTH,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 0,
  },
  showSideMobile: {
    height: 400,
    minHeight: 'calc(100vh - 50px)',
    overflow: 'scroll',
    width: '100vw',
    paddingHorizontal: 16,
  },
  showSide: {
    marginHorizontal: 24,
    opacity: 1,
  },
  hideSide: {
    transform: [{ translateX: 310 }],
  },
  role: {
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 4,
    lineHeight: 20,
    marginBottom: 4,
  },
  contributor: {
    marginBottom: 16,
  },
  line: {
    width: 26,
    height: 1,
    backgroundColor: colors.dark,
  },
  copyButton: { marginLeft: 10 },
  aside: {
    fontSize: 18,
    lineHeight: 24,
  },
  chevronButton: {
    fontFamily: typeFaces.garamond,
    fontWeight: 'bold',
    marginTop: 20,
  },
  mobileTitle: {
    fontSize: 30,
  },
})
