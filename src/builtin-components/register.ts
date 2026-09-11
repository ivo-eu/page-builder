import { registry } from '../registry'
import { ButtonManifest } from './Button/manifest'
import { TextManifest } from './Text/manifest'
import { InputManifest } from './Input/manifest'
import { ImageManifest } from './Image/manifest'
import { ContainerManifest } from './Container/manifest'
import { ModalManifest } from './Modal/manifest'
import { TableManifest } from './Table/manifest'
import { HeadingManifest } from './Heading/manifest'
import { DividerManifest } from './Divider/manifest'
import { CardManifest } from './Card/manifest'
import { LinkManifest } from './Link/manifest'
import { ParagraphManifest } from './Paragraph/manifest'
import { SwitchManifest } from './Switch/manifest'
import { AvatarManifest } from './Avatar/manifest'

export function registerBuiltinComponents() {
  registry.register(ButtonManifest)
  registry.register(TextManifest)
  registry.register(InputManifest)
  registry.register(ImageManifest)
  registry.register(ContainerManifest)
  registry.register(ModalManifest)
  registry.register(TableManifest)
  registry.register(HeadingManifest)
  registry.register(DividerManifest)
  registry.register(CardManifest)
  registry.register(LinkManifest)
  registry.register(ParagraphManifest)
  registry.register(SwitchManifest)
  registry.register(AvatarManifest)
}
